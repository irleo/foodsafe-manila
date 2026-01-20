import axios from "axios";
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { notify } from "../utils/toast";

import { ArrowLeft, Activity, Eye, EyeOff } from "lucide-react";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const Login = () => {
  const { setAuth } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

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

      await notify.promise(Promise.resolve(res), {
        loading: "Logging you in…",
        success: "Login succesful!",
        error: (e) => e?.response?.data?.message || "Login failed.",
      });

      navigate("/");
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        "Login failed. Please check your credentials.";

      setError(msg);
      notify?.error?.(msg);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link
          to="/welcome"
          className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back to Home</span>
        </Link>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="flex items-center justify-center mb-8">
            <div className="bg-blue-600 p-3 rounded-xl">
              <Activity className="w-8 h-8 text-white" />
            </div>
          </div>

          <h1 className="text-center mb-2 text-xl font-semibold">
            Disease Monitoring System
          </h1>
          <p className="text-center text-gray-600 mb-8">
            Department of Health - Philippines
          </p>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <form className="space-y-6" onSubmit={handleLogin} autoComplete="on">
            <div>
              <label
                htmlFor="email"
                className="block mb-2 text-sm text-gray-700"
              >
                Email / Username
              </label>
              <input
                id="email"
                type="email"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="user@doh.gov.ph"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                disabled={loading}
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block mb-2 text-sm text-gray-700"
              >
                Password
              </label>

              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all pr-12"
                  placeholder="Enter your password"
                  required
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                  disabled={loading}
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  disabled={loading}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading && (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {loading ? "Logging in..." : "Login"}
            </button>

            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                className="text-blue-600 hover:text-blue-700"
                onClick={() =>
                  notify?.info?.("Forgot password flow not set up yet.")
                }
              >
                Forgot Password?
              </button>

              <Link
                to="/request-access"
                className="text-blue-600 hover:text-blue-700"
              >
                Request Access
              </Link>
            </div>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-center text-sm text-gray-600 mb-4">
              Don't have an account?
            </p>

            <Link
              to="/request-access"
              className="block w-full text-center px-4 py-3 border-2 border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
            >
              Request for Access
            </Link>
          </div>

          <div className="mt-6 text-center text-sm text-gray-600">
            <p>Demo Credentials:</p>
            <p className="mt-2">Admin: admin@doh.gov.ph / @Password1</p>
            <p>User: user@doh.gov.ph / @Password2</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
