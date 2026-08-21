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
        error: (e) => e?.response?.data?.message || "Logout failed.",
      });
    } catch (error) {
      console.error("Logout failed", error);
    } finally {
      setAuth(null);
      navigate("/login", { replace: true });
    }
  };

  const links = [
          { name: "Dashboard", path: "/dashboard", icon: Squares2X2Icon },
          ...(["admin", "cesu"].includes(auth?.role) ? [{
            name: "Data Upload",
            path: "/datasets",
            icon: ArrowDownOnSquareIcon,
          }] : []),
          ...(["admin", "cesu", "surveillance_team"].includes(auth?.role) ? [{
            name: "Report Logs",
            path: "/reports",
            icon: ClipboardDocumentCheckIcon,
          }] : []),
          { name: "Heatmap", path: "/heatmap", icon: MapIcon },
          { name: "Analytics", path: "/analytics", icon: ChartPieIcon },
          {
            name: "Predictions",
            path: "/predictions",
            icon: ArrowTrendingUpIcon,
          },
          ...(auth?.role === "admin" ? [{
            name: "User Management",
            path: "/user-management",
            icon: UserGroupIcon,
          }] : []),
        ];

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
        <nav className="p-4 space-y-1">
          {links.map(({ name, path, icon, end }) => (
            <NavLink
              key={path}
              to={path}
              end={end}
              onClick={onClose}
              className={({ isActive }) =>
                [
                  "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                  isActive
                    ? "bg-blue-50 text-blue-700 border border-blue-200 font-medium"
                    : "text-gray-700 hover:bg-gray-100",
                ].join(" ")
              }
            >
              {({ isActive }) => (
                <>
                  {createElement(icon, {
                    className: [
                      "h-5 w-5",
                      isActive ? "text-blue-700" : "text-gray-500",
                    ].join(" "),
                  })}
                  <span className="flex-1">{name}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {auth?.accessToken && (
          <div className="mt-auto px-4 py-2 border-t border-gray-200">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full text-red-600 px-4 py-3 rounded-lg hover:bg-red-100 cursor-pointer"
            >
              <ArrowLeftStartOnRectangleIcon className="h-5 w-5" />
              Logout
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
