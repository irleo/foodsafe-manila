import { useAuth } from "../context/AuthContext";
import { formatStatusLabel } from "../utils/formatStatusLabel";
import {
  BellIcon,
  UserCircleIcon,
  Bars3Icon,
} from "@heroicons/react/24/outline";
import { PanelLeft } from "lucide-react";
import NotificationsDropdown from "./NotificationsDropdown";
import Spinner from "./Spinner";
import { useEffect, useRef, useState } from "react";
import logo from "../assets/foodsafe_logo_nav.png";
import { notify } from "../utils/toast";
import { logClientError } from "../utils/errors";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
const configuredPollMs = Number(import.meta.env.VITE_NOTIFICATION_POLL_MS);
const NOTIFICATION_POLL_MS =
  Number.isFinite(configuredPollMs) && configuredPollMs >= 15000
    ? configuredPollMs
    : 60000;

export default function Navbar({
  isSidebarOpen,
  toggleSidebar,
  isSidebarCollapsed,
  toggleSidebarCollapsed,
}) {
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
      } catch (error) {
        if (!isMounted) return;
        logClientError("Failed to refresh notifications", error);
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
      } catch (error) {
        if (!isMounted) return;
        logClientError("Failed to load notifications", error);
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
    } catch (error) {
      logClientError("Failed to update notification", error);
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
    } catch (error) {
      logClientError("Failed to mark notifications as read", error);
    }
  };

  if (loading) return <Spinner />;

  return (
    <header className="sticky top-0 z-30 border-b border-[#0c3a6b] bg-[#134c8c] text-white">
      <nav className="relative z-50 px-4 shadow-sm sm:px-6 lg:px-0">
        <div className="flex h-16 min-w-0 items-center justify-between gap-2">

          {/* Logo */}
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              aria-label={isSidebarOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-controls="dashboard-navigation"
              aria-expanded={isSidebarOpen}
              onClick={toggleSidebar}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg hover:bg-blue-500 lg:hidden"
            >
              <Bars3Icon className="h-6 w-6" />
            </button>
            <span className="hidden h-16 w-20 shrink-0 items-center justify-center lg:flex">
              <button
                type="button"
                aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                aria-pressed={isSidebarCollapsed}
                title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                onClick={toggleSidebarCollapsed}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              >
                <PanelLeft className="h-4 w-4" aria-hidden="true" />
              </button>
            </span>
            <img
              src={logo}
              className="h-8 w-auto max-w-[8.75rem] select-none object-contain sm:h-10 sm:max-w-[8.75rem]"
              alt="FoodSafe Manila"
              draggable="false"
              decoding="async"
            />
          </div>

          {/* Right side */}
          <div className="flex shrink-0 items-center gap-1 sm:gap-4 lg:pr-8">

            {/* Notifications */}
            <div className="relative" ref={notificationsRef}>
              <button
                type="button"
                aria-label="Toggle notifications"
                aria-expanded={open}
                onClick={() => setOpen((o) => !o)}
                className={`rounded-lg p-2.5 transition ${
                  hasUnread
                    ? "bg-white/15 ring-1 ring-white/30 hover:bg-white/20"
                    : "hover:bg-white/10"
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
              <div className="flex items-center gap-2 border-l border-white/20 pl-2 sm:pl-4">
                <UserCircleIcon className="h-7 w-7 text-white" />

                <div className="mx-1 hidden flex-col leading-tight sm:flex">
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
