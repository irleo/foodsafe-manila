import { useAuth } from "../context/AuthContext";
import { formatStatusLabel } from "../utils/formatStatusLabel";
import {
  BellIcon,
  UserCircleIcon,
  Bars3Icon,
} from "@heroicons/react/24/outline";
import NotificationsDropdown from "./NotificationsDropdown";
import Spinner from "./Spinner";
import { useEffect, useRef, useState } from "react";
import logo from "../../../mobile/assets/foodsafe_logo.png";
import { notify } from "../utils/toast";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
const configuredPollMs = Number(import.meta.env.VITE_NOTIFICATION_POLL_MS);
const NOTIFICATION_POLL_MS =
  Number.isFinite(configuredPollMs) && configuredPollMs >= 15000
    ? configuredPollMs
    : 60000;

export default function Navbar() {
  const { auth, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const unusualSeenRef = useRef(new Set());
  const unusualBootstrappedRef = useRef(false);
  const notificationsRef = useRef(null);
  const token = auth?.accessToken;
  const hasUnread = notifications.some((n) => n?.unread);

  const fetchNotifications = async () => {
    if (!token) return;
    const res = await fetch(`${API_BASE}/api/notifications?page=1&limit=10`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    });
    if (!res.ok) throw new Error("Failed to fetch notifications");
    const data = await res.json();
    setNotifications(Array.isArray(data?.items) ? data.items : []);
  };

  useEffect(() => {
    if (!token) {
      setNotifications([]);
      return;
    }

    let isMounted = true;
    let requestInFlight = false;
    const runFetch = async () => {
      if (document.visibilityState !== "visible" || requestInFlight) return;
      requestInFlight = true;
      try {
        const res = await fetch(`${API_BASE}/api/notifications?page=1&limit=10`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
        });
        if (!res.ok) throw new Error("Failed to fetch notifications");
        const data = await res.json();
        if (!isMounted) return;
        setNotifications(Array.isArray(data?.items) ? data.items : []);
      } catch {
        if (!isMounted) return;
      } finally {
        requestInFlight = false;
      }
    };

    runFetch();
    const timer = setInterval(runFetch, NOTIFICATION_POLL_MS);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") runFetch();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isMounted = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [token]);

  useEffect(() => {
    if (!open) return;

    const handleOutsideInteraction = (event) => {
      if (!notificationsRef.current?.contains(event.target)) setOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", handleOutsideInteraction);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handleOutsideInteraction);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !token) return;

    let isMounted = true;

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/notifications?page=1&limit=10`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
        });
        if (!res.ok) throw new Error("Failed to fetch notifications");
        const data = await res.json();
        if (!isMounted) return;
        setNotifications(Array.isArray(data?.items) ? data.items : []);
      } catch {
        if (!isMounted) return;
        setNotifications([]);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [open, token]);

  useEffect(() => {
    const unusual = notifications.filter((n) => n?.type === "report_unusual");

    if (!unusualBootstrappedRef.current) {
      unusual.forEach((n) => unusualSeenRef.current.add(n.id));
      unusualBootstrappedRef.current = true;
      return;
    }

    for (const n of unusual) {
      if (!n?.unread) continue;
      if (unusualSeenRef.current.has(n.id)) continue;
      unusualSeenRef.current.add(n.id);
      notify.info(`${n.title}: ${n.message}`);
    }
  }, [notifications]);

  const toggleUnread = async (notification) => {
    if (!token || !notification?.id) return;
    const endpoint = notification.unread
      ? `${API_BASE}/api/notifications/${notification.id}/read`
      : `${API_BASE}/api/notifications/${notification.id}/unread`;
    try {
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update notification");
      await fetchNotifications();
    } catch {
      // no-op
    }
  };

  const markAllRead = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/notifications/read-all`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to mark all as read");
      await fetchNotifications();
    } catch {
      // no-op
    }
  };

  if (loading) return <Spinner />;

  return (
    <header className="bg-blue-600 border-b border-blue-800 sticky top-0 z-30 text-white">
      <nav className="px-4 sm:px-6 lg:px-8 shadow-sm z-50 relative">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <div className="flex items-center gap-2">
            <img
              src={logo}
              className="h-9 sm:h-10 w-auto object-contain select-none"
              alt="FoodSafe Manila"
              draggable="false"
              decoding="async"
            />
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2 sm:gap-4">

            {/* Notifications */}
            <div className="relative" ref={notificationsRef}>
              <button
                type="button"
                aria-label="Toggle notifications"
                aria-expanded={open}
                onClick={() => setOpen((o) => !o)}
                className={`p-2.5 rounded-lg transition ${
                  hasUnread
                    ? "bg-blue-500/30 ring-1 ring-blue-300 hover:bg-blue-500/40"
                    : "hover:bg-blue-600"
                }`}
              >
                <BellIcon className="h-6 w-6 text-white" />

                {hasUnread ? (
                  <span className="absolute right-1 top-1 inline-flex h-2.5 w-2.5 rounded-full bg-red-400" />
                ) : null}
              </button>

              {open && (
                <NotificationsDropdown
                  items={notifications}
                  onToggleUnread={toggleUnread}
                  onMarkAllRead={markAllRead}
                />
              )}
            </div>

            {/* User */}
            {auth?.accessToken && (
              <div className="flex items-center gap-2 border-l border-blue-500 pl-4">
                <UserCircleIcon className="h-7 w-7 text-white" />

                <div className="mx-1 flex flex-col leading-tight">
                  <span className="font-medium text-white">
                    {auth?.username ?? "Guest"}
                  </span>

                  {auth?.role && (
                    <span className="text-xs text-blue-100">
                      {formatStatusLabel(auth.role)}
                    </span>
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
