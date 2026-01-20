export default function NotificationsDropdown({ items = [] }) {
  return (
    <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
      <div className="p-4 border-b border-gray-200">
        <h3 className="font-semibold text-[18px]">Notifications</h3>
      </div>

      <div className="max-h-96 overflow-y-auto">
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
                      : "bg-blue-500",
                ].join(" ")}
              />
              <div className="flex-1">
                <p className="text-sm">{n.title}</p>
                <p className="text-xs text-gray-600 mt-1">{n.message}</p>
                <p className="text-xs text-gray-400 mt-1">{n.time}</p>
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
