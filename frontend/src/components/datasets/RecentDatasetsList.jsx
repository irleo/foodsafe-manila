import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownTrayIcon,
  CalendarIcon,
  DocumentIcon,
} from "@heroicons/react/24/outline";
import { formatDate } from "../../utils/formatDate";

export default function RecentDatasetsList({
  recent,
  loading,
  onRefresh,
  onDownload,
}) {
  const PAGE_SIZE = 5;
  const [page, setPage] = useState(0);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil((recent?.length || 0) / PAGE_SIZE));
  }, [recent?.length]);

  // Keep page valid when list changes (e.g. after refresh/upload)
  useEffect(() => {
    setPage((p) => Math.min(p, totalPages - 1));
  }, [totalPages]);

  const pageItems = useMemo(() => {
    const start = page * PAGE_SIZE;
    return (recent || []).slice(start, start + PAGE_SIZE);
  }, [recent, page]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">Recent Datasets</h2>
        <button
          className="text-sm px-3 py-1 rounded-lg border border-gray-300 hover:bg-gray-50"
          onClick={() => {
            setPage(0); // reset to first page on refresh (optional)
            onRefresh?.();
          }}
          disabled={loading}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading datasets…</p>
      ) : (recent?.length || 0) === 0 ? (
        <p className="text-sm text-gray-500">No datasets uploaded yet.</p>
      ) : (
        <>
          <div className="space-y-3">
            {pageItems.map((d) => (
              <div
                key={d._id}
                className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <DocumentIcon className="w-8 h-6 text-gray-700" />
                    <div>
                      <p className="font-medium">{d.name}</p>
                      <p className="text-sm text-gray-600 mt-1">
                        {d.recordsCount?.toLocaleString?.() ??
                          d.recordsCount ??
                          "-"}{" "}
                        records
                      </p>

                      <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <CalendarIcon className="w-4 h-4" />
                          {formatDate(d.createdAt || d.uploadedAt)}
                        </span>

                        <span
                          className={[
                            "px-2 py-1 rounded",
                            d.status === "validated"
                              ? "bg-green-100 text-green-700"
                              : d.status === "failed"
                              ? "bg-red-100 text-red-700"
                              : "bg-yellow-100 text-yellow-700",
                          ].join(" ")}
                        >
                          {d.status || "pending"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    className="p-2 hover:bg-gray-100 rounded-lg"
                    onClick={() => onDownload(d._id)}
                    title="Download"
                  >
                    <ArrowDownTrayIcon className="w-5 h-5 text-gray-700" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination footer */}
          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Showing {page * PAGE_SIZE + 1}–
              {Math.min((page + 1) * PAGE_SIZE, recent.length)} of {recent.length}
            </p>

            {/* Dots */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                Prev
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }).map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setPage(i)}
                    aria-label={`Go to page ${i + 1}`}
                    className={[
                      "h-2.5 w-2.5 rounded-full transition",
                      i === page
                        ? "bg-blue-600"
                        : "bg-gray-300 hover:bg-gray-400",
                    ].join(" ")}
                  />
                ))}
              </div>

              <button
                type="button"
                className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page === totalPages - 1}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
