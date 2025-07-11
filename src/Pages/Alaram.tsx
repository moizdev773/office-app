// src/pages/AlarmPage.tsx
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useSocket } from "../hooks/useSocket";
import axios from "axios";

interface Reading {
  gatewayId: string;
  timestamp: string;
  data: Record<string, Record<string, number>>;
}

interface AlarmSetting {
  category: string;
  subcategory: string;
  high: number;
  low: number;
  priority: "High" | "Medium" | "Low";
}

interface AlarmItem {
  _id?: string;
  timestamp: string;
  category: string;
  subcategory: string;
  value: number;
  priority: AlarmSetting["priority"];
}

export default function AlarmPage() {
  const { search } = useLocation();
  const gatewayId = new URLSearchParams(search).get("gateway")!;

  const [settings, setSettings] = useState<AlarmSetting[]>([]);
  const [alarms, setAlarms] = useState<AlarmItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const perPage = 20;
  const [totalPages, setTotalPages] = useState(1);

  // 1) Load saved alarms from DB (paginated)
  useEffect(() => {
    if (!gatewayId) return;
    setLoading(true);

    axios
      .get<{
        data: AlarmItem[];
        total: number;
        page: number;
        totalPages: number;
      }>(
        "http://localhost:3000/api/alarm-records",
        { params: { gatewayId, page, limit: perPage } }
      )
      .then(res => {
        setAlarms(res.data.data);
        setTotalPages(res.data.totalPages);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [gatewayId, page]);

  // 2) Load settings once
  useEffect(() => {
    axios
      .get<AlarmSetting[]>(
        "http://localhost:3000/api/alarm-settings",
        { params: { gatewayId } }
      )
      .then(res => setSettings(res.data))
      .catch(console.error);
  }, [gatewayId]);

  // 3) Socket subscription for new readings
  useSocket((reading: Reading) => {
    if (!settings.length) return;
    const newAlarms: AlarmItem[] = [];

    Object.entries(reading.data).forEach(([cat, subObj]) => {
      const subs = subObj as Record<string, number>;
      Object.entries(subs).forEach(([sub, val]) => {
        const cfg = settings.find(
          s => s.category === cat && s.subcategory === sub
        );
        if (!cfg) return;
        if (val > cfg.high || val < cfg.low) {
          newAlarms.push({
            timestamp: reading.timestamp,
            category: cat,
            subcategory: sub,
            value: val,
            priority: cfg.priority,
          });
        }
      });
    });

    // save to DB
    newAlarms.forEach(alarm => {
      axios
        .post("http://localhost:3000/api/alarm-records", {
          gatewayId,
          ...alarm,
        })
        .catch(console.error);
    });

    // update UI: prepend new alarms and optionally trim to perPage if you like
    setAlarms(prev => [...newAlarms, ...prev].slice(0, perPage));
    // reset page back to 1 so user sees newest
    // setPage(1);
  }, gatewayId);

  // if (loading) return <p>Loading alarms…</p>;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Alarm Page for {gatewayId}</h1>

      {loading ? (
        // ← Skeleton Loader Shuru
        <div className="animate-pulse space-y-2">
          {[...Array(perPage)].map((_, i) => (
            <div
              key={i}
              className="h-10 bg-gray-200 rounded-md"
            />
          ))}
        </div>
        // ← Skeleton Loader Khatam
      ) : alarms.length === 0 ? (
        <p>No alarms detected.</p>
      ) : (
        <>
          <div className="overflow-x-auto border rounded">
            <table className="min-w-full table-fixed">
              <thead className="bg-gray-200 sticky top-0">
                <tr>
                  <th className="w-1/5 px-3 py-2 text-left">Time</th>
                  <th className="w-1/5 px-3 py-2 text-left">Category</th>
                  <th className="w-1/5 px-3 py-2 text-left">Subcategory</th>
                  <th className="w-1/5 px-3 py-2 text-left">Value</th>
                  <th className="w-1/5 px-3 py-2 text-left">Priority</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {alarms.map((a, i) => (
                  <tr key={a._id || i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="px-3 py-2">{new Date(a.timestamp).toLocaleString()}</td>
                    <td className="px-3 py-2">{a.category}</td>
                    <td className="px-3 py-2">{a.subcategory}</td>
                    <td className={`px-3 py-2 font-mono ${
                      a.priority === "High"   ? "text-red-600" :
                      a.priority === "Medium" ? "text-orange-500" :
                      "text-green-600"
                    }`}>
                      {a.value}
                    </td>
                    <td className={`px-3 py-2 font-semibold ${
                      a.priority === "High"   ? "text-red-600" :
                      a.priority === "Medium" ? "text-orange-500" :
                      "text-green-600"
                    }`}>
                      {a.priority}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="flex justify-between items-center mt-4">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 bg-gray-300 rounded disabled:opacity-50"
            >
              Previous
            </button>
            <span>Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 bg-gray-300 rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
