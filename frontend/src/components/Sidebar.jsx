import { createElement } from "react";
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
} from "@heroicons/react/24/outline";
import { useAuth } from "../context/AuthContext";
import axios from "axios";
import { notify } from "../utils/toast";
import { getErrorMessage, logClientError } from "../utils/errors";

export default function Sidebar({ isOpen, onClose }) {
  const { auth, setAuth } = useAuth();
  const navigate = useNavigate();

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
          ? [{ name: "Predictions", path: "/predictions", icon: ArrowTrendingUpIcon }]
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
        fixed left-0 top-16 z-20 h-[calc(100dvh-4rem)] w-64 overflow-y-auto border-r border-gray-200 bg-white
        transition-transform duration-300 lg:sticky lg:shrink-0
        ${isOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0
      `}
    >
      <div className="flex flex-col h-full">
        <nav className="space-y-5 p-4">
          {navigationGroups.map((group) => (
            <section key={group.label} aria-labelledby={`nav-${group.label.replaceAll(" ", "-").toLowerCase()}`}>
              <h2
                id={`nav-${group.label.replaceAll(" ", "-").toLowerCase()}`}
                className="mb-2 px-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400"
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
                    className={({ isActive }) =>
                      [
                        "flex items-center gap-3 rounded-lg px-4 py-3 transition-colors",
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
                        <span className="flex-1">{name}</span>
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </section>
          ))}
        </nav>

        {auth?.accessToken && (
          <div className="mt-auto border-t border-gray-200 px-4 py-2">
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-red-600 hover:bg-red-100"
            >
              <ArrowLeftStartOnRectangleIcon className="h-5 w-5 shrink-0" />
              <span>Logout</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
