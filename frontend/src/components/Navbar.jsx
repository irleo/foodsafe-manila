import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  BellAlertIcon,
  UserCircleIcon,
  Bars3Icon,
} from "@heroicons/react/24/outline";

import logo from "../assets/react.svg";
import Spinner from "./Spinner";

export default function Navbar({ toggleSidebar }) {
  const { auth, loading } = useAuth();
  if (loading) return <Spinner />;

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
      <nav className="px-4 sm:px-6 lg:px-8 shadow-sm z-50">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="lg:hidden">
              <button
                className="p-2 rounded-lg hover:bg-gray-100"
                onClick={toggleSidebar}
              >
                <Bars3Icon className="h-6 w-6" />
              </button>
            </div>
            <Link to="/" className="flex items-center gap-2 font-bold text-lg">
              <img src={logo} alt="logo" className="h-8" />
              FoodSafe Manila
            </Link>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <div className="relative">
              <button className="p-2 rounded-lg hover:bg-gray-100 relative">
                <BellAlertIcon className="h-6 w-6" />
              </button>
            </div>

            {auth?.accessToken && (
              <div className="flex items-center gap-1 border-l border-gray-200 pl-4">
                <UserCircleIcon className="h-6 w-6" />
                <span span className="mx-1 md:block">
                  {auth?.username ?? "Guest"}
                </span>
              </div>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}
