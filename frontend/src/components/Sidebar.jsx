import { Link, useNavigate } from "react-router-dom";

import { HomeIcon, FolderIcon, ChartBarIcon, MapIcon, UserGroupIcon, ArrowRightOnRectangleIcon, ArrowLeftStartOnRectangleIcon, ArrowTrendingUpIcon, ChartPieIcon, Squares2X2Icon, ArrowDownOnSquareIcon } from "@heroicons/react/24/outline";
import { useAuth } from "../context/AuthContext";
import axios from "axios";

export default function Sidebar({ isOpen }) {
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
        { name: "Dashboard", path: "/", icon: Squares2X2Icon },
        { name: "Dataset Upload", path: "/datasets", icon: ArrowDownOnSquareIcon },
        { name: "Heatmap", path: "/heatmap", icon: MapIcon },
        { name: "Analytics", path: "/analytics", icon: ChartPieIcon },
        { name: "Predictions", path: "/predictions", icon: ArrowTrendingUpIcon },
        { name: "User Management", path: "/user-management", icon: UserGroupIcon },
      ]
    : [
        { name: "Dashboard", path: "/", icon: Squares2X2Icon },
        { name: "Dataset Upload", path: "/datasets", icon: ArrowDownOnSquareIcon },
        { name: "Heatmap", path: "/heatmap", icon: MapIcon },
        { name: "Analytics", path: "/analytics", icon: ChartPieIcon },
        { name: "Predictions", path: "/predictions", icon: ArrowTrendingUpIcon },
      ];

  return (
     <>
     <aside
        className={`
        fixed lg:sticky top-16 left-0 h-[calc(100vh-4rem)] bg-white border-r border-gray-200 z-20
        transition-transform duration-300 w-64
        ${isOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0
      `}
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
        <div className="mt-auto p-4">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full text-red-600 px-4 py-3 rounded-lg hover:bg-red-100"
          >
            <ArrowLeftStartOnRectangleIcon className="h-5 w-5" />
            Logout
          </button>
        </div>
      )}
      </div>
    </aside>
    </>
  );
}
