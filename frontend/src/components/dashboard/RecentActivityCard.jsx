import { Link } from "react-router-dom";

function timeAgo(input) {
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "";

  const diffMs = Date.now() - d.getTime();
  if (diffMs < 0) return "Just now";

  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min${mins > 1 ? "s" : ""} ago`;

  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs > 1 ? "s" : ""} ago`;

  const days = Math.floor(hrs / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}

const typeDotClass = (type) => {
  if (type === "dataset_uploaded") return "bg-blue-500";
  if (type === "dataset_validated") return "bg-cyan-500";
  if (type === "prediction_generated") return "bg-purple-500";
  if (type === "user_approved") return "bg-green-500";
  if (type === "user_rejected") return "bg-red-500";
  if (type === "password_reset") return "bg-green-500";
  if (type === "report_submitted") return "bg-yellow-500";
  if (type === "investigation_recorded") return "bg-blue-500";
  if (type === "marked_suspected") return "bg-amber-500";
  if (type === "report_ruled_out" || type === "case_not_validated") return "bg-gray-500";
  if (type === "case_confirmed") return "bg-green-500";
  if (type === "case_marked_probable") return "bg-cyan-500";
  if (type === "analytics_exported") return "bg-indigo-500";
  return "bg-gray-400";
};

export default function RecentActivityCard({
  items = [],
  title = "Recent Operational Activity",
}) {
  const visibleItems = items.slice(0, 4);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="mb-4">
        <h2 className="font-semibold">{title}</h2>
        <p className="mt-1 text-xs text-gray-500">
          Citizen-report workflow and system administration
        </p>
      </div>

      {visibleItems.length === 0 ? (
        <div className="flex min-h-85 flex-col items-center justify-center px-6 py-10 text-center">
          <p className="text-xs font-medium text-gray-700">No recent activity</p>
        </div>
      ) : (
        <div className="space-y-4">
          {visibleItems.map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-3 pb-4 border-b border-gray-100 last:border-0"
            >
              <div className={`w-2 h-2 rounded-full mt-2 ${typeDotClass(item.type)}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm">{item.title}</p>

                {item.subtitle && (
                  <p className="text-xs text-gray-600 mt-1">{item.subtitle}</p>
                )}

                <p className="text-xs text-gray-400 mt-1">
                  {item.actor?.username ? `${item.actor.username} · ` : ""}
                  {timeAgo(item.createdAt)}
                </p>
                {item.source === "report_workflow" && (
                  <Link
                    to="/reports"
                    className="mt-1 inline-flex min-h-10 items-center text-xs font-medium text-blue-600 hover:text-blue-700"
                  >
                    Open Report Logs
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
