import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Activity, Mail } from "lucide-react";
import { notify } from "../utils/toast";

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

export default function ForgotPassword() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  const handleSend = async (e) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError("Please enter your email.");
      return;
    }

    try {
      setLoading(true);

      // MOCK ONLY (ready for real implementation later)
      // Later you can replace with:
      // await axios.post("/api/auth/forgot-password", { email }, { withCredentials: true });

      await notify.promise(delay(900), {
        loading: "Sending reset link…",
        success: "Reset link sent (mock).",
        error: "Failed to send reset link.",
      });

      setSent(true);
    } catch (err) {
      setError(err?.response?.data?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link
          to="/login"
          className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back to Login</span>
        </Link>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="flex items-center justify-center mb-8">
            <div className="bg-blue-600 p-3 rounded-xl">
              <Activity className="w-8 h-8 text-white" />
            </div>
          </div>

          <h1 className="text-center mb-2 text-xl font-semibold">
            Reset Your Password
          </h1>
          <p className="text-center text-gray-600 mb-8">
            Enter your email and we’ll send a reset link.
          </p>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {!sent ? (
            <form className="space-y-6" onSubmit={handleSend} autoComplete="on">
              <div>
                <label className="block mb-2 text-sm text-gray-700" htmlFor="email">
                  Email Address
                </label>

                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="email"
                    type="email"
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="user@sample.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    required
                  />
                </div>

                <p className="mt-2 text-xs text-gray-500">
                  We’ll send a link if the email exists in our system.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading && (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                {loading ? "Sending..." : "Send Reset Link"}
              </button>

              <div className="text-center text-sm text-gray-600">
                Remembered your password?{" "}
                <Link to="/login" className="text-blue-600 hover:text-blue-700">
                  Login
                </Link>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                <p className="font-semibold">Check your email</p>
                <p className="mt-1">
                  If <span className="font-medium">{email}</span> is registered,
                  you’ll receive a reset link shortly.
                </p>
              </div>

              <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                <p className="font-semibold mb-1">Mock preview</p>
                <p className="text-xs text-gray-600">
                  In production, this would open the link from the email. For UI testing,
                  you can use:
                </p>

                <Link
                  to="/reset-password"
                  className="mt-3 inline-flex items-center justify-center w-full px-4 py-3 rounded-lg bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-sm"
                >
                  Continue to Reset Password Screen
                </Link>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSent(false);
                  setEmail("");
                  setError(null);
                }}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors text-sm"
              >
                Send Another Link
              </button>

              <div className="text-center text-sm text-gray-600">
                <Link to="/login" className="text-blue-600 hover:text-blue-700">
                  Back to Login
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
