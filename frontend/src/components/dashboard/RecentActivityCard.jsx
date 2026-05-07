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
  if (type === "report_reviewed") return "bg-yellow-500";
  if (type === "alert_acknowledged") return "bg-orange-500";
  if (type === "analytics_exported") return "bg-indigo-500";
  return "bg-gray-400";
};

export default function RecentActivityCard({
  items = [],
  title = "Recent Activity",
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="mb-4 font-semibold">{title}</h2>

      {items.length === 0 ? (
        <div className="flex min-h-85 flex-col items-center justify-center px-6 py-10 text-center">
          <p className="text-xs font-medium text-gray-700">No recent activity</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
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
                  {timeAgo(item.createdAt)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}