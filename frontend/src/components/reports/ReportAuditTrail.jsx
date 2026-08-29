import { useEffect, useState } from "react";
import { ChevronDown, History } from "lucide-react";
import { formatStatusLabel } from "../../utils/formatStatusLabel";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

export default function ReportAuditTrail({ reportId, token }) {
  const [items, setItems] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const response = await fetch(`${API_BASE}/api/reports/${reportId}/audit?limit=100`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || "Unable to load audit trail.");
        if (active) setItems(Array.isArray(data.items) ? data.items : []);
      } catch (error) {
        if (active) setErrorMessage(error.message || "Unable to load audit trail.");
      }
    })();

    return () => {
      active = false;
    };
  }, [reportId, token]);

  return (
    <details className="group mt-3 overflow-hidden rounded-lg border border-violet-200 bg-white">
      <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 bg-violet-50 px-3 py-2 text-sm font-medium text-violet-950 marker:content-none hover:bg-violet-100/70">
        <span className="inline-flex items-center gap-2">
          <History className="h-4 w-4 text-violet-700" />
          Audit trail
          {items.length > 0 && (
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs text-violet-700">{items.length}</span>
          )}
        </span>
        <ChevronDown className="h-4 w-4 text-violet-700 transition group-open:rotate-180" />
      </summary>
      <div className="max-h-56 overflow-y-auto border-t border-violet-100 px-3 py-3">
        {errorMessage ? (
          <p className="text-xs text-red-700">{errorMessage}</p>
        ) : items.length === 0 ? (
          <p className="text-xs text-gray-500">No recorded actions yet.</p>
        ) : (
          <ol className="space-y-2.5">
            {items.map((item) => (
              <li key={item._id} className="flex gap-2 text-xs text-gray-700">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                <span>
                  <strong>{formatStatusLabel(item.action)}</strong> by {item.actorId?.username || "authorized user"}
                  <span className="mt-0.5 block text-[11px] text-gray-500">
                    {formatStatusLabel(item.previousStatus)} → {formatStatusLabel(item.newStatus)} · {new Date(item.createdAt).toLocaleString()}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </details>
  );
}
