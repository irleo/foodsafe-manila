import { Cog6ToothIcon } from "@heroicons/react/24/outline";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const SETTINGS_ROLES = new Set(["admin", "cesu"]);

export default function SettingsShortcut() {
  const { auth } = useAuth();

  if (!SETTINGS_ROLES.has(auth?.role)) {
    return null;
  }

  return (
    <div className="group fixed bottom-5 right-5 z-40 flex items-center gap-2 sm:bottom-6 sm:right-6">
      <div
        role="tooltip"
        className="pointer-events-none invisible max-w-64 translate-x-2 rounded-lg border border-gray-200 bg-gray-900 px-3 py-2 text-right text-xs font-medium leading-5 text-white opacity-0 shadow-lg transition-all duration-150 group-hover:visible group-hover:translate-x-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-x-0 group-focus-within:opacity-100"
      >
        Configure surveillance thresholds and excluded outbreak periods
      </div>

      <NavLink
        to="/settings"
        aria-label="Open surveillance threshold settings"
        className={({ isActive }) => [
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-full border shadow-lg transition-all duration-150 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 sm:h-14 sm:w-14",
          isActive
            ? "border-blue-700 bg-blue-700 text-white"
            : "border-blue-200 bg-white text-blue-700 hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-50 hover:shadow-xl",
        ].join(" ")}
      >
        <Cog6ToothIcon className="h-6 w-6" aria-hidden="true" />
      </NavLink>
    </div>
  );
}
