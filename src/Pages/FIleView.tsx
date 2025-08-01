import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import FileViewChart from "../Components/FileViewChart";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

interface ReadingData {
  [category: string]: { [subcategory: string]: number };
}

interface Reading {
  gatewayId: string;
  timestamp: string;
  data: ReadingData;
}

// ... (imports and interfaces remain unchanged)

export default function FileView() {
  const [allData, setAllData] = useState<Reading[]>([]);
  const [filteredData, setFilteredData] = useState<Reading[]>([]);
  const [gatewayIds, setGatewayIds] = useState<string[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false); // 👈 loading state

  const { gatewayId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const selectedGateway = searchParams.get("gateway") || "";
  const selectedCategory = searchParams.get("category");
  const selectedSubcategories = searchParams.get("subs")?.split(",") || [];
  const startDate = searchParams.get("startDate") || "";
  const endDate = searchParams.get("endDate") || "";
  const secInterval = parseInt(searchParams.get("secInterval") || "0", 10);
  const switchToChart = searchParams.get("view") || "table";
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = 50;

  const [localStartDate, setLocalStartDate] = useState(startDate);
  const [localEndDate, setLocalEndDate] = useState(endDate);
  const [localInterval, setLocalInterval] = useState(secInterval);

  const isFilterValid =
    (localStartDate && localEndDate) || localInterval > 0;

  const updateParams = (changes: Record<string, string | null>) => {
    const updated = new URLSearchParams(searchParams.toString());
    Object.entries(changes).forEach(([k, v]) => {
      if (!v) updated.delete(k);
      else updated.set(k, v);
    });
    setSearchParams(updated);
  };

  useEffect(() => {
    if (gatewayId && !selectedGateway) {
      updateParams({ gateway: gatewayId });
    }
  }, [gatewayId, selectedGateway]);

  useEffect(() => {
    axios
      .get<string[]>("http://localhost:3000/api/gateways")
      .then((res) => setGatewayIds(res.data))
      .catch(console.error);
  }, []);

  const fetchData = (showLoader: boolean) => {
    if (!selectedGateway) return;

    const params: any = { gatewayId: selectedGateway, page, limit };
    if (startDate) params.startDate = new Date(startDate).toISOString();
    if (endDate) params.endDate = new Date(endDate).toISOString();
    if (secInterval > 0) params.interval = secInterval;

    if (showLoader) setIsLoading(true);
    axios
      .get("http://localhost:3000/api/readingsdynamic", { params })
      .then((res) => {
        const data = res.data.data as Reading[];
        setAllData(data);
        setTotalCount(res.data.total as number);
        setFilteredData(data);

        if (!selectedCategory && data.length) {
          const firstCat = Object.keys(data[0].data)[0];

          // collect all unique subs across all records for firstCat
          const uniqueSubs = new Set<string>();
          data.forEach((item) => {
            const subs = item.data[firstCat];
            if (subs) {
              Object.keys(subs).forEach((key) => uniqueSubs.add(key));
            }
          });

          updateParams({
            category: firstCat,
            subs: Array.from(uniqueSubs).join(","),
          });
        }
      })
      .catch(console.error)
      .finally(() => {
        if (showLoader) {
          setTimeout(() => setIsLoading(false), 300);
        }
      });
  };

  useEffect(() => {
    if (selectedGateway && (startDate || endDate || secInterval > 0)) {
      fetchData(false);
    }
  }, [selectedGateway, startDate, endDate, secInterval, page]);

  useEffect(() => {
    if (selectedGateway && !startDate && !endDate && secInterval === 0) {
      fetchData(false);
    }
  }, [selectedGateway, page]);
  const handleFilter = () => {
    if (localStartDate && !localEndDate) {
      toast.error("Please select an End Date.");
      return;
    }
    if (localEndDate && !localStartDate) {
      toast.error("Please select a Start Date.");
      return;
    }
    if (!localStartDate && !localEndDate && localInterval <= 0) {
      toast.error("Please provide a date range or an interval.");
      return;
    }

    updateParams({
      startDate: localStartDate || null,
      endDate: localEndDate || null,
      secInterval: localInterval > 0 ? String(localInterval) : null,
      page: "1",
    });
    fetchData(true);
  };

  useEffect(() => {
    setLocalStartDate(startDate);
    setLocalEndDate(endDate);
    setLocalInterval(secInterval || 0);
  }, [startDate, endDate, secInterval]);


  const handleGatewayChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    updateParams({ gateway: val, page: "1", category: "", subs: "" });
    navigate(`/fileview${val ? `?gateway=${val}` : ""}`);
  };

  const toggleSub = (sub: string) => {
    const upd = selectedSubcategories.includes(sub)
      ? selectedSubcategories.filter((s) => s !== sub)
      : [...selectedSubcategories, sub];
    updateParams({ subs: upd.join(",") });
  };

  const getSubs = (): string[] => {
    const s = new Set<string>();
    filteredData.forEach((e) => {
      const cat = e.data[selectedCategory!];
      if (cat) Object.keys(cat).forEach((sub) => s.add(sub));
    });
    return Array.from(s);
  };

  const getCategories = (): string[] => {
    const categories = new Set<string>();
    filteredData.forEach((entry) => {
      Object.keys(entry.data).forEach((cat) => categories.add(cat));
    });
    return Array.from(categories);
  };

  const getSubcategoriesByCategory = (cat: string): string[] => {
  const subSet = new Set<string>();
  filteredData.forEach((entry) => {
    const subData = entry.data[cat];
    if (subData) {
      Object.keys(subData).forEach((sub) => subSet.add(sub));
    }
  });
  return Array.from(subSet);
};


  return (
    <div className="mx-3">
      <ToastContainer />
      <h1 className="text-2xl font-bold ml-5">File View</h1>

      {/* Date-Time + Seconds Interval */}
      <div className="flex items-center mx-10 justify-between my-4 mt-10 space-x-4">
        <span className="font-semibold">Select Range</span>
        <label className="flex items-center gap-2">
          From
          <input
            type="datetime-local"
            value={localStartDate}
            onChange={(e) => setLocalStartDate(e.target.value)}
            className="p-1 border rounded"
          />
        </label>
        <label className="flex items-center gap-2">
          To
          <input
            type="datetime-local"
            value={localEndDate}
            min={localStartDate || undefined}
            onChange={(e) => setLocalEndDate(e.target.value)}
            className="p-1 border rounded"
          />
        </label>
        <label className="flex items-center gap-2">
          Seconds interval
          <input
            type="number"
            min="1"
            max="59"
            value={localInterval || ""}
            onChange={(e) => setLocalInterval(parseInt(e.target.value) || 0)}
            className="w-20 p-1 border rounded"
          />
        </label>
        <button
          className={`px-4 py-1 rounded text-white ${isFilterValid ? "bg-blue-600" : "bg-gray-400 cursor-not-allowed"}`}
          onClick={handleFilter}
          disabled={!isFilterValid}
        >
          Apply
        </button>
      </div>

      <div className="flex mt-10">
        {/* Sidebar */}
        <div className="w-64 bg-gray-800 text-white p-4">
          <select
            className="w-full mb-4 p-2 text-black rounded"
            value={selectedGateway}
            onChange={handleGatewayChange}
          >
            <option value="" disabled>
              Select Gateway
            </option>
            {gatewayIds.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>

          <h2 className="text-xl font-bold mb-4">Categories</h2>
          {getCategories().map((cat) => (
            <button
              key={cat}
              onClick={() => {
                const subs = getSubcategoriesByCategory(cat);
                updateParams({ category: cat, subs: subs.join(",") });
              }}
              className={`block w-full text-left px-2 py-1 mb-1 rounded ${selectedCategory === cat ? "bg-gray-700" : "hover:bg-gray-700"
                }`}
            >
              {cat}
            </button>
          ))}


          {selectedCategory && (
            <div className="mt-4">
              <h3 className="font-semibold mb-2">Subcategories</h3>
              {getSubs().map((sub) => (
                <label key={sub} className="flex items-center gap-2 mb-1">
                  <input
                    type="checkbox"
                    checked={selectedSubcategories.includes(sub)}
                    onChange={() => toggleSub(sub)}
                  />
                  {sub}
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="flex-1 mx-3">
          {isLoading ? (
            <div className="text-center text-gray-500 text-lg py-10">
              Loading data...
            </div>
          ) : selectedGateway ? (
            switchToChart === "table" ? (
              <div>
                <div className="flex items-center justify-between mx-2">
                  <h2 className="text-2xl font-bold mb-4">Data Table</h2>
                  <div >
                    <button className="mr-3" onClick={() => updateParams({ view: "chart" })}>
                      Switch To Chart
                    </button>
                    <button
                      onClick={() =>
                        navigate(`/fileview/export?${searchParams.toString()}`)
                      }
                      className="bg-green-600 text-white px-3 py-1 rounded"
                    >
                      Export File
                    </button>
                  </div>
                </div>
                <table className="w-full bg-white rounded shadow">
                  <thead>
                    <tr className="bg-gray-200">
                      <th className="px-4 py-2 text-left">Date</th>
                      <th className="px-4 py-2 text-left">Time</th>
                      {selectedSubcategories.map((sub) => (
                        <th key={sub} className="px-4 py-2 text-left">
                          {sub}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.map((entry, i) => {
                      const d = new Date(entry.timestamp);
                      return (
                        <tr key={i} className="border-t">
                          <td className="px-4 py-2">
                            {d.toLocaleDateString()}
                          </td>
                          <td className="px-4 py-2">
                            {d.toLocaleTimeString()}
                          </td>
                          {selectedSubcategories.map((sub) => (
                            <td key={sub} className="px-4 py-2">
                              {entry.data[selectedCategory!]?.[sub] ?? "-"}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="flex justify-end items-center gap-2 mt-4">
                  <button
                    className="bg-gray-300 px-3 py-1 rounded disabled:opacity-50"
                    disabled={page === 1}
                    onClick={() => updateParams({ page: String(page - 1) })}
                  >
                    Previous
                  </button>
                  <span>
                    Page {page} of {Math.ceil(totalCount / limit)}
                  </span>
                  <button
                    className="bg-gray-300 px-3 py-1 rounded disabled:opacity-50"
                    disabled={page * limit >= totalCount}
                    onClick={() => updateParams({ page: String(page + 1) })}
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : (
              <div className="w-[90%] mx-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold mb-4">Data Chart</h2>
                  <button onClick={() => updateParams({ view: "table" })}>
                    Switch To Table
                  </button>
                </div>
                {selectedCategory && selectedSubcategories.length ? (
                  <FileViewChart
                    data={filteredData}
                    category={selectedCategory}
                    subcategories={selectedSubcategories}
                  />
                ) : (
                  <p className="text-gray-600">
                    No data to display. Select a category/subcategories.
                  </p>
                )}
              </div>
            )
          ) : (
            <div className="text-gray-500">
              Please select a gateway to view data.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
