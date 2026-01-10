import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext";

import { UserCircleIcon, Bars3Icon } from "@heroicons/react/24/outline";

import logo from "../assets/react.svg";

export default function Navbar({ onToggleSidebar }) {
  const { auth } = useAuth();

  return (
    <nav className="w-full h-16 bg-white shadow-sm flex px-4 items-center">
      {/* Logo */}
      <Link to="/" className="flex items-center gap-2 font-bold text-lg">
        <img src={logo} alt="logo" className="h-8" />
        FoodSafe Manila
      </Link>

      <div className="flex-1" />

      {auth?.accessToken && (
        
        <div className="flex">
          <button
            onClick={onToggleSidebar}
            className="flex items-center gap-2 mr-7 hover:text-green-600"
          >
            <Bars3Icon className="h-6 w-6"/>
          </button>

            <UserCircleIcon className="h-6 w-6" />
            <span className="mx-1 md:block">Profile</span>
        </div>
        
      )}
    </nav>
  );
}

