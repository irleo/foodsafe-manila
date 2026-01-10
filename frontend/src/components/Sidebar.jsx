import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { HomeIcon, FolderIcon, ChartBarIcon, MapIcon, UserGroupIcon, ArrowRightOnRectangleIcon } from "@heroicons/react/24/outline";
import { useAuth } from "../context/AuthContext";
import axios from "axios";

export default function Sidebar({ open, onClose }) {
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
        { name: "Dashboard", path: "/dashboard", icon: HomeIcon },
        { name: "Dataset Upload", path: "/datasets", icon: FolderIcon },
        { name: "Heatmap", path: "/heatmap", icon: MapIcon },
        { name: "Analytics", path: "/analytics", icon: ChartBarIcon },
        { name: "Predictions", path: "/predictions", icon: ChartBarIcon },
        { name: "User Management", path: "/user-management", icon: UserGroupIcon },
      ]
    : [
        { name: "Dashboard", path: "/dashboard", icon: HomeIcon },
        { name: "Heatmap", path: "/heatmap", icon: MapIcon },
        { name: "Analytics", path: "/analytics", icon: ChartBarIcon },
        { name: "Predictions", path: "/my-predictions", icon: ChartBarIcon },
      ];

  return (
     <>
      {/* Backdrop
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-40"
          onClick={onClose}
        />
      )} */}

     <aside
        className={`fixed top-16 left-0 h-[calc(100%-4rem)] w-64 bg-white shadow z-50
        transform transition-transform duration-300
        ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
      <div className="flex flex-col h-full">
      {/* Links */}
      <nav className="flex-1 px-2 py-4 space-y-3 text-lg">
        {links.map(({ name, path, icon: Icon }) => (
          <Link
            key={path}
            to={path}
            className="flex items-center gap-2 p-2 rounded hover:bg-gray-200"
          >
            <Icon className="h-5 w-5" />
            {name}
          </Link>
        ))}
      </nav>

      {/* Logout button */}
      {auth?.accessToken && (
        <button
          onClick={handleLogout}
          className="mt-auto flex items-center gap-2 text-red-600 px-5 py-4 rounded hover:bg-red-100 text-lg"
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
