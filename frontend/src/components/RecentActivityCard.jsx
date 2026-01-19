function timeAgo(input) {
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "";

  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;

  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs > 1 ? "s" : ""} ago`;

  const days = Math.floor(hrs / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}

const typeDotClass = (type) => {
  if (type === "dataset_uploaded") return "bg-blue-500";
  if (type === "high_risk_alert") return "bg-red-500";
  if (type === "prediction_generated") return "bg-purple-500";
  if (type === "user_approved") return "bg-green-500";
  return "bg-gray-400";
};

export default function RecentActivityCard({ items = [], title = "Recent Activity" }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="mb-4 font-semibold">{title}</h2>

      {items.length === 0 ? (
        <p className="text-sm text-gray-500">No recent activity.</p>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <div
              key={item._id || item.id}
              className="flex items-start gap-3 pb-4 border-b border-gray-100 last:border-0"
            >
              <div className={`w-2 h-2 rounded-full mt-2 ${typeDotClass(item.type)}`} />
              <div className="flex-1">
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
