import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { UserCircleIcon } from "@heroicons/react/24/outline";

import logo from "../assets/react.svg";
import Spinner from "./Spinner"

export default function Navbar() {
  const { auth, loading } = useAuth();
  if (loading) return <Spinner />;

  return (
    <nav className="w-full h-16 bg-white shadow-sm flex px-4 items-center z-50">
      {/* Logo */}
      <Link to="/" className="flex items-center gap-2 font-bold text-lg">
        <img src={logo} alt="logo" className="h-8" />
        FoodSafe Manila
      </Link>

      <div className="flex-1" />

      {auth?.accessToken && (
        
        <div className="flex">

            <UserCircleIcon className="h-6 w-6" />
            <span span className="mx-1 md:block">{auth?.username ?? "Guest"}</span>
        </div>
        
      )}
    </nav>
  );
}

