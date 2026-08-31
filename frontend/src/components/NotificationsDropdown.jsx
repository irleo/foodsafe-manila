import { Link } from "react-router-dom";

const TYPE_LABELS = {
  report_new: "Citizen report",
  report_unusual: "Operational review",
  dataset_validated: "Dataset",
  dataset_failed: "Dataset",
  user_access_request: "User access",
  password_reset: "Account",
  prediction_generated: "Forecast",
};

function timeAgo(input, fallback) {
  const value = new Date(input);
  if (Number.isNaN(value.getTime())) return fallback || "";
  const minutes = Math.max(0, Math.floor((Date.now() - value.getTime()) / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export default function NotificationsDropdown({
  items = [],
  onToggleUnread,
  onMarkAllRead,
}) {
  return (
    <div className="fixed left-3 right-3 top-16 z-50 mt-2 rounded-lg border border-gray-200 bg-white shadow-lg sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:w-80">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between gap-2">
        <h3 className="font-semibold text-black text-[18px]">Notifications</h3>
        <button
          type="button"
          onClick={onMarkAllRead}
          className="text-xs text-blue-600 hover:text-blue-700"
        >
          Mark all read
        </button>
      </div>

      <div className="max-h-[70dvh] overflow-x-hidden overflow-y-auto sm:max-h-96">
        {items.map((n) => (
          <div
            key={n.id}
            className={[
              "p-4 border-b border-gray-100 hover:bg-gray-50",
              n.unread ? "bg-blue-50" : "",
            ].join(" ")}
          >
            <div className="flex items-start gap-3">
              <div
                className={[
                  "w-2 h-2 rounded-full mt-2",
                  n.dotColor === "yellow"
                    ? "bg-yellow-500"
                    : n.dotColor === "green"
                      ? "bg-green-500"
                      : n.dotColor === "red"
                        ? "bg-red-500"
                        : n.dotColor === "orange"
                          ? "bg-orange-500"
                        : n.dotColor === "purple"
                          ? "bg-purple-500"
                      : "bg-blue-500",
                ].join(" ")}
              />
              <div className="min-w-0 flex-1">
                {/* <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600">
                  {TYPE_LABELS[n.type] || "System"}
                </span> */}
                <p className="break-words text-sm text-black">{n.title}</p>
                <p className="mt-1 break-words text-xs text-gray-600">{n.message}</p>
                {n.type === "report_unusual" && (
                  <p className="mt-2 rounded-md bg-orange-50 px-2 py-1.5 text-[11px] leading-4 text-orange-800">
                    Configurable operational trigger only — not an official alert,
                    epidemic threshold, or outbreak determination.
                  </p>
                )}
                <p className="mt-1 text-xs text-gray-400">
                  {timeAgo(n.createdAt, n.time)}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-3">
                  {n.type?.startsWith("report_") && (
                    <Link
                      to="/reports"
                      className="inline-flex min-h-10 items-center text-xs font-medium text-blue-600 hover:text-blue-700"
                    >
                      Open Report Logs
                    </Link>
                  )}
                  <button
                    type="button"
                    className="min-h-10 text-xs underline text-blue-600 hover:text-blue-700 hover:cursor-pointer"
                    onClick={() => onToggleUnread?.(n)}
                  >
                    {n.unread ? "Mark as read" : "Mark as unread"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}

        {items.length === 0 && (
          <div className="p-4 text-sm text-gray-500">No notifications.</div>
        )}
      </div>
    </div>
  );
}
