import axios from "axios";
import { EnvelopeIcon, KeyIcon } from "@heroicons/react/24/outline";
import logo from "../assets/react.svg";

import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const Login = () => {
  const { setAuth } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null); // clear previous errors
    setLoading(true); // show loading

    try {
      const res = await axios.post("/api/auth/login", form, {
        withCredentials: true,
      });

      await delay(600);
      setAuth({
        accessToken: res.data.accessToken,
        role: res.data.user.role,
        username: res.data.user.username,
      });

      // console.log(res.data);
      navigate("/"); // Redirect to home after login
    } catch (err) {
      setError("Login failed. Please check your credentials.");
      console.error(err);
    } finally {
      setLoading(false);
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
          Login to FoodSafe Manila
        </h4>

        {error && <div className="text-red-600 text-center mb-4">{error}</div>}

        <form onSubmit={handleLogin} autoComplete="off">
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
              className="w-full bg-orange-400 hover:bg-orange-500 text-white py-2 rounded-md font-medium transition flex justify-center items-center gap-2"
              disabled={loading} // prevent double click
            >
              {loading && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {loading ? "Logging in..." : "Login"}
            </button>
          </div>

          <div className="text-center text-sm">
            Don't have an account?{" "}
            <Link to="/register" className="text-orange-500 hover:underline">
              Register
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
