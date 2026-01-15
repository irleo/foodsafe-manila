import { Link, useNavigate } from "react-router-dom";

import { HomeIcon, FolderIcon, ChartBarIcon, MapIcon, UserGroupIcon, ArrowRightOnRectangleIcon } from "@heroicons/react/24/outline";
import { useAuth } from "../context/AuthContext";
import axios from "axios";

export default function Sidebar() {
  const { auth, setAuth } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await axios.post("/api/auth/logout", {}, { withCredentials: true });
      setAuth(null);
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const links = auth?.role === "admin"
    ? [
        { name: "Dashboard", path: "/", icon: HomeIcon },
        { name: "Dataset Upload", path: "/datasets", icon: FolderIcon },
        { name: "Heatmap", path: "/heatmap", icon: MapIcon },
        { name: "Analytics", path: "/analytics", icon: ChartBarIcon },
        { name: "Predictions", path: "/predictions", icon: ChartBarIcon },
        { name: "User Management", path: "/user-management", icon: UserGroupIcon },
      ]
    : [
        { name: "Dashboard", path: "/", icon: HomeIcon },
        { name: "Heatmap", path: "/heatmap", icon: MapIcon },
        { name: "Analytics", path: "/analytics", icon: ChartBarIcon },
        { name: "Predictions", path: "/predictions", icon: ChartBarIcon },
      ];

  return (
     <>
     <aside
        className={`top-16 left-0 h-full w-64 bg-white shadow 
        transform transition-transform duration-300`}
      >
      <div className="flex flex-col h-full">
      {/* Links */}
      <nav className="p-4 space-y-1">
        {links.map(({ name, path, icon: Icon }) => (
          <Link
            key={path}
            to={path}
            className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-200"
          >
            <Icon className="h-5 w-5 me-1" />
            {name}
          </Link>
        ))}
      </nav>

      {/* Logout button */}
      {auth?.accessToken && (
        <button
          onClick={handleLogout}
          className="mt-auto flex items-center gap-2 text-red-600 px-4 py-4 rounded hover:bg-red-100 text-md"
        >
          <ArrowRightOnRectangleIcon className="h-5 w-5" />
          Logout
        </button>
      )}
      </div>
    </aside>
    </>
  );
}
