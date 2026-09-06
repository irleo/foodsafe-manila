import { useEffect, useState } from "react";
import Navbar from "../components/navigation/Navbar";
import Sidebar from "../components/navigation/Sidebar";
import SettingsShortcut from "../components/navigation/SettingsShortcut";
import { Outlet } from "react-router-dom";

export default function DashboardLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const toggleSidebar = () => setIsSidebarOpen((prev) => !prev);
  const toggleSidebarCollapsed = () => setIsSidebarCollapsed((current) => !current);
  const closeSidebar = () => setIsSidebarOpen(false);

  useEffect(() => {
    if (!isSidebarOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") closeSidebar();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isSidebarOpen]);

  return (
    <div className="min-h-[100dvh] bg-gray-50">
      <div className="flex min-h-[100dvh] flex-col">
        {/* Navbar */}
        <Navbar
          isSidebarOpen={isSidebarOpen}
          toggleSidebar={toggleSidebar}
          isSidebarCollapsed={isSidebarCollapsed}
          toggleSidebarCollapsed={toggleSidebarCollapsed}
        />

        <div className="flex min-w-0 flex-1">
          {/* Sidebar */}
          <Sidebar isOpen={isSidebarOpen} onClose={closeSidebar} isCollapsed={isSidebarCollapsed} />
          {isSidebarOpen && (
            <button
              type="button"
              aria-label="Close navigation menu"
              className="fixed inset-0 top-16 z-10 bg-slate-950/40 lg:hidden"
              onClick={closeSidebar}
            />
          )}
          {/* Main content */}
          <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
            <Outlet />
          </main>
        </div>
        <SettingsShortcut />
      </div>
    </div>
  );
}
