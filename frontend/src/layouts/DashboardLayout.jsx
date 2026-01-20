import { useState } from "react";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import { Outlet } from "react-router-dom";

export default function DashboardLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const toggleSidebar = () => setIsSidebarOpen((prev) => !prev);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex flex-col min-h-screen">
        {/* Navbar */}
        <Navbar toggleSidebar={toggleSidebar} />

        <div className="flex">
          {/* Sidebar */}
          <Sidebar isOpen={isSidebarOpen} />
          {/* Main content */}
          <main
            className={`
              flex-1 p-4 sm:p-6 lg:p-8
              transition-all duration-300 ml-0 lg:ml-0 
              ${isSidebarOpen ? "ml-64" : "ml-0"}
            `}
          >
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
