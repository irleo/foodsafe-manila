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

      <div className="max-h-96 overflow-x-hidden overflow-y-auto">
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
                        : n.dotColor === "purple"
                          ? "bg-purple-500"
                      : "bg-blue-500",
                ].join(" ")}
              />
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm text-black">{n.title}</p>
                <p className="mt-1 break-words text-xs text-gray-600">{n.message}</p>
                <p className="text-xs text-gray-400 mt-1">{n.time}</p>
                <button
                  type="button"
                  className="text-[11px] text-blue-600 hover:text-blue-700 mt-1"
                  onClick={() => onToggleUnread?.(n)}
                >
                  {n.unread ? "Mark as read" : "Mark as unread"}
                </button>
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
