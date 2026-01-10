import axios from "axios";
import { EnvelopeIcon, KeyIcon, TagIcon } from "@heroicons/react/24/outline";
import logo from "../assets/react.svg";

import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";

const Register = () => {
  const navigate = useNavigate();
  const [showSuccess, setShowSuccess] = useState(false);

  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post("/api/auth/register", form, { withCredentials: true });
      setShowSuccess(true);
    } catch (err) {
      setError("Registration failed. Please check your credentials.");
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen flex justify-center items-center relative bg-gray-100">
      {/* Background image overlay
      <div
        className="absolute inset-0 bg-cover bg-center opacity-50 pointer-events-none"
        style={{ backgroundImage: "url('/assets/images/surevice-bg.png')" }}
      ></div> */}

      {/* Card */}
      <div className="relative z-10 w-full max-w-md p-8 rounded-lg shadow-md bg-white transform scale-105">
        <img
          src={logo}
          alt="FoodSafe Manila Logo"
          className="w-56 mx-auto mb-4"
        />
        <h4 className="text-center text-xl font-semibold mb-6">
          Register to FoodSafe Manila
        </h4>

        {error && <div className="text-red-600 text-center mb-4">{error}</div>}

        <form onSubmit={handleSubmit} autoComplete="off">
          {/* Username */}
          <div className="mb-4">
            <label htmlFor="username" className="block mb-1 font-medium">
              Username
            </label>
            <div className="flex items-center border rounded-md bg-gray-100 px-3">
              <TagIcon className="h-5 w-5 text-gray-400 mr-2" />
              <input
                type="text"
                id="username"
                name="username"
                placeholder="Enter username"
                required
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                className="w-full bg-gray-100 p-2 outline-none text-sm"
              />
            </div>
          </div>
          {/* Email */}
          <div className="mb-4">
            <label htmlFor="email" className="block mb-1 font-medium">
              Email
            </label>
            <div className="flex items-center border rounded-md bg-gray-100 px-3">
              <EnvelopeIcon className="h-5 w-5 text-gray-400 mr-2" />
              <input
                type="email"
                id="email"
                name="email"
                placeholder="Enter email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full bg-gray-100 p-2 outline-none text-sm"
              />
            </div>
          </div>

          {/* Password */}
          <div className="mb-6">
            <label htmlFor="password" className="block mb-1 font-medium">
              Password
            </label>
            <div className="flex items-center border rounded-md bg-gray-100 px-3">
              <KeyIcon className="h-5 w-5 text-gray-400 mr-2" />
              <input
                type="password"
                id="password"
                name="password"
                placeholder="Enter password"
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full bg-gray-100 p-2 outline-none text-sm"
              />
            </div>
          </div>

          {/* Submit */}
          <div className="mb-4">
            <button
              type="submit"
              className="w-full bg-blue-400 hover:bg-blue-500 text-white py-2 rounded-md font-medium transition"
            >
              Register
            </button>
          </div>

          <div className="text-center text-sm">
            Already have an account?{" "}
            <Link to="/login" className="text-orange-500 hover:underline">
              Login
            </Link>
          </div>
        </form>
      </div>

      {showSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg p-6 w-80 text-center shadow-lg">
            <h3 className="text-lg font-semibold mb-2">
              Registration Successful
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Your account has been created. You can now log in.
            </p>

            <button
              onClick={() => navigate("/login")}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white py-2 rounded-md transition"
            >
              Go to Login
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Register;
