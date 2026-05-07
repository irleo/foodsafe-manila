import { useAuth } from "../context/AuthContext";
import {
  BellIcon,
  UserCircleIcon,
  Bars3Icon,
} from "@heroicons/react/24/outline";
import NotificationsDropdown from "./NotificationsDropdown";
import Spinner from "./Spinner";
import { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

export default function Navbar({ toggleSidebar }) {
  const { auth, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const token = auth?.accessToken;
  const hasUnread = notifications.some((n) => n?.unread);

  useEffect(() => {
    if (!open || !token) return;

    let isMounted = true;

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/notifications?limit=5`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
        });

        if (!res.ok) {
          throw new Error("Failed to fetch notifications");
        }

        const data = await res.json();
        if (!isMounted) return;
        setNotifications(Array.isArray(data) ? data : []);
      } catch {
        if (!isMounted) return;
        setNotifications([]);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [open, token]);

  if (loading) return <Spinner />;

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
      <nav className="px-4 sm:px-6 lg:px-8 shadow-sm z-50 relative">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="lg:hidden">
              <button
                className="p-2 rounded-lg hover:bg-gray-100"
                onClick={toggleSidebar}
              >
                <Bars3Icon className="h-6 w-6" />
              </button>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-lg">
                <svg
                  width="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  className="lucide lucide-activity w-6 h-6 text-white">
                  <path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"></path>
                </svg>
              </div>
              <div>
                <h1 className="text-sm sm:text-base font-semibold">
                  Foodborne Disease Monitoring System
                </h1>
                <p className="text-xs text-gray-600 hidden sm:block">
                  Foodsafe - Manila
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <div className="relative">
              <button
                onClick={() => setOpen((o) => !o)}
                className="p-2 rounded-lg hover:bg-gray-100 relative"
              >
                <BellIcon className="h-6 w-6" />
                {hasUnread ? (
                  <span className="absolute right-1 top-1 inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                ) : null}
              </button>
              {open && <NotificationsDropdown items={notifications} />}
            </div>

            {auth?.accessToken && (
              <div className="flex items-center gap-1 border-l border-gray-200 pl-4">
                <UserCircleIcon className="h-7 w-7 " />
                <div className="mx-1 flex flex-col leading-tight">
                  <span className="font-medium">
                    {auth?.username ?? "Guest"}
                  </span>
                  {auth?.role && (
                    <span className="text-xs text-gray-500">{auth.role}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}
