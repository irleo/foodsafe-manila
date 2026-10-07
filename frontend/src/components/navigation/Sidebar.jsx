import { createElement, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  MapIcon,
  UserGroupIcon,
  ArrowLeftStartOnRectangleIcon,
  ArrowTrendingUpIcon,
  ChartPieIcon,
  Squares2X2Icon,
  ArrowDownOnSquareIcon,
  ClipboardDocumentCheckIcon,
  Cog6ToothIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "../../context/AuthContext";
import axios from "axios";
import { notify } from "../../utils/toast";
import { getErrorMessage, logClientError } from "../../utils/errors";

export default function Sidebar({ isOpen, onClose, isCollapsed = false }) {
  const { auth, setAuth } = useAuth();
  const navigate = useNavigate();
  const [showLogoutConfirmation, setShowLogoutConfirmation] = useState(false);

  const handleLogout = async () => {
    try {
      const logoutPromise = axios.post(
        "/api/auth/logout",
        {},
        { withCredentials: true },
      );

      await notify.promise(logoutPromise, {
        loading: "Logging you out…",
        success: "Logged out successfully!",
        error: (error) => getErrorMessage(error, "Logout failed."),
      });
    } catch (error) {
      logClientError("Logout failed", error);
    } finally {
      setAuth(null);
      navigate("/login", { replace: true });
    }
  };

  const navigationGroups = [
    {
      label: "Situational Awareness",
      links: [
        { name: "Dashboard", path: "/dashboard", icon: Squares2X2Icon },
        { name: "Heatmap", path: "/heatmap", icon: MapIcon },
        { name: "Analytics", path: "/analytics", icon: ChartPieIcon },
      ],
    },
    {
      label: "Casework",
      links: [
        ...(["admin", "cesu", "surveillance_team"].includes(auth?.role)
          ? [{ name: "Report Logs", path: "/reports", icon: ClipboardDocumentCheckIcon }]
          : []),
        ...(["admin", "cesu"].includes(auth?.role)
          ? [{ name: "Data Upload", path: "/datasets", icon: ArrowDownOnSquareIcon }]
          : []),
      ],
    },
    {
      label: "Administration",
      links: [
        ...(["admin", "cesu"].includes(auth?.role)
          ? [
              { name: "Predictions", path: "/predictions", icon: ArrowTrendingUpIcon },
              { name: "Settings", path: "/settings", icon: Cog6ToothIcon },
            ]
          : []),
        ...(auth?.role === "admin"
          ? [{ name: "User Management", path: "/user-management", icon: UserGroupIcon }]
          : []),
      ],
    },
  ].filter((group) => group.links.length > 0);

  return (
    <aside
      id="dashboard-navigation"
      aria-label="Primary navigation"
      className={`
        fixed left-0 top-16 z-20 h-[calc(100dvh-4rem)] w-64 max-w-[calc(100vw-2rem)] overflow-y-auto border-r border-gray-200 bg-white
        transition-[transform,width] duration-300 lg:sticky lg:shrink-0
        ${isOpen ? "visible translate-x-0" : "invisible -translate-x-full"}
        lg:visible lg:max-w-none lg:translate-x-0
        ${isCollapsed ? "lg:w-20" : "lg:w-64"}
      `}
    >
      <div className="flex flex-col h-full">
        <nav className={`space-y-5 p-4 ${isCollapsed ? "lg:p-3" : ""}`}>
          {navigationGroups.map((group) => (
            <section key={group.label} aria-labelledby={`nav-${group.label.replaceAll(" ", "-").toLowerCase()}`}>
              <h2
                id={`nav-${group.label.replaceAll(" ", "-").toLowerCase()}`}
                className={`mb-2 px-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400 ${isCollapsed ? "lg:hidden" : ""}`}
              >
                {group.label}
              </h2>
              <div className="space-y-1">
                {group.links.map(({ name, path, icon, end }) => (
                  <NavLink
                    key={path}
                    to={path}
                    end={end}
                    onClick={onClose}
                    title={isCollapsed ? name : undefined}
                    className={({ isActive }) =>
                      [
                        "flex items-center gap-3 rounded-lg px-4 py-3 transition-colors",
                        isCollapsed ? "lg:justify-center lg:px-0" : "",
                        isActive
                          ? "border border-blue-200 bg-blue-50 font-medium text-blue-700"
                          : "text-gray-700 hover:bg-gray-100",
                      ].join(" ")
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {createElement(icon, {
                          className: [
                            "h-5 w-5 shrink-0",
                            isActive ? "text-blue-700" : "text-gray-500",
                          ].join(" "),
                        })}
                        <span className={`flex-1 ${isCollapsed ? "lg:hidden" : ""}`}>{name}</span>
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </section>
          ))}
        </nav>

        {auth?.accessToken && (
          <div className={`mt-auto border-t border-gray-200 py-2 ${isCollapsed ? "lg:px-3" : "px-4"}`}>
            <button
              onClick={() => setShowLogoutConfirmation(true)}
              title={isCollapsed ? "Logout" : undefined}
              className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-red-600 hover:bg-red-100 ${isCollapsed ? "lg:justify-center lg:px-0" : ""}`}
            >
              <ArrowLeftStartOnRectangleIcon className="h-5 w-5 shrink-0" />
              <span className={isCollapsed ? "lg:hidden" : ""}>Logout</span>
            </button>
          </div>
        )}
      </div>
      {showLogoutConfirmation && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onMouseDown={() => setShowLogoutConfirmation(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-confirmation-title"
            aria-describedby="logout-confirmation-description"
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h2 id="logout-confirmation-title" className="text-lg font-semibold text-gray-900">
              Log out
            </h2>
            <p id="logout-confirmation-description" className="mt-2 text-sm text-gray-600">
              Are you sure you want to log out?
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShowLogoutConfirmation(false)}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLogoutConfirmation(false);
                  void handleLogout();
                }}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
