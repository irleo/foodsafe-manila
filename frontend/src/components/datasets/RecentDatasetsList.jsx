import {
  ArrowDownTrayIcon,
  CalendarIcon,
  DocumentIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";
import { RefreshCw } from "lucide-react";
import { formatDate } from "../../utils/formatDate";

export default function RecentDatasetsList({
  recent,
  pagination,
  loading,
  onRefresh,
  onPageChange,
  onDownload,
  showFailed,
  onShowFailedChange,
}) {
  const page = pagination?.page || 1;
  const limit = pagination?.limit || 5;
  const total = pagination?.total || 0;
  const totalPages = pagination?.totalPages || 1;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-semibold">Recent Datasets</h2>
          <p className="text-xs text-gray-500">Upload audit log</p>
        </div>
        <button
          className="flex items-center gap-1 text-sm px-3 py-2.5 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
          onClick={() => onRefresh?.(page)}
          disabled={loading}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading datasets…</p>
      ) : (recent?.length || 0) === 0 ? (
        <p className="text-sm text-gray-500">No datasets uploaded yet.</p>
      ) : (
        <>
          <div className="flex mb-1">
            <label className="flex items-center gap-2 text-sm text-gray-600 ml-auto">
              <input
                type="checkbox"
                checked={showFailed}
                onChange={(e) => onShowFailedChange(e.target.checked)}
              />
              Show failed uploads
            </label>
          </div>
          
          <div className="space-y-3">
            {recent.map((d) => (
              <div
                key={d._id}
                className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <DocumentIcon className="w-8 h-6 text-gray-700" />
                    <div>
                      <p className="font-medium">{d.name || d.originalFileName || d.storedFileName || "Unnamed file"}</p>
                      <p className="text-sm text-gray-600 mt-1">
                        {d.recordsCount?.toLocaleString?.() ??
                          d.recordsCount ??
                          "-"}{" "}
                        records
                      </p>

                      {d.status === "failed" && d.errorMessage && (
                        <p className="text-xs text-red-600 mt-1">
                          {d.errorMessage}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <CalendarIcon className="w-4 h-4" />
                          {formatDate(d.createdAt || d.uploadedAt)}
                        </span>

                        <span className="flex items-center gap-1">
                          <UserCircleIcon className="w-4 h-4" />
                          Uploaded by{" "}
                          {d.uploadedBy?.username ||
                            d.uploadedBy?.email ||
                            "Unknown user"}
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
                    className="p-2.5 hover:bg-gray-100 rounded-lg disabled:opacity-50"
                    onClick={() => onDownload(d._id)}
                    disabled={d.status !== "validated"}
                    title={
                      d.status !== "validated" ? "Unavailable" : "Download"
                    }
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
              Showing {(page - 1) * limit + 1}–
              {Math.min(page * limit, total)} of {total}
            </p>

            {/* Dots */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="text-xs px-3 py-2.5 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
                onClick={() => onPageChange?.(page - 1)}
                disabled={page <= 1 || loading}
              >
                Prev
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }).map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onPageChange?.(i + 1)}
                    aria-label={`Go to page ${i + 1}`}
                    className={[
                      "h-10 w-10 rounded-full border text-xs font-medium transition",
                      i + 1 === page
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50",
                    ].join(" ")}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>

              <button
                type="button"
                className="text-xs px-3 py-2.5 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
                onClick={() => onPageChange?.(page + 1)}
                disabled={page >= totalPages || loading}
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
