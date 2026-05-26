import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Activity, Mail } from "lucide-react";
import { notify } from "../utils/toast";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);
  const [devOtp, setDevOtp] = useState("");
  const [devOtpExpiry, setDevOtpExpiry] = useState(null);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const otpRefs = useRef([]);

  const handleSend = async (e) => {
    e.preventDefault();
    setError(null);

    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setError("Please enter your email.");
      return;
    }

    try {
      setLoading(true);
      const sendPromise = fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
      }).then(async (res) => {
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j?.message || "Failed to send reset code.");
        return j;
      });
      notify.promise(sendPromise, {
        loading: "Sending reset code...",
        success: "Reset code sent.",
        error: "Failed to send reset code.",
      });
      const result = await sendPromise;

      setDevOtp(result?.devFallback ? String(result?.debugOtp || "") : "");
      setDevOtpExpiry(
        result?.devFallback && Number.isFinite(Number(result?.debugExpiresMinutes))
          ? Number(result.debugExpiresMinutes)
          : null,
      );
      setSent(true);
    } catch (err) {
      setError(err?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const hasInProgress = sent || email.trim().length > 0 || otp.join("").length > 0;

  const confirmCancel = () =>
    !hasInProgress ||
    window.confirm(
      "This password reset transaction will be cancelled. Do you want to continue?",
    );

  const handleOtpChange = (index, rawValue) => {
    const nextValue = String(rawValue || "").replace(/\D+/g, "").slice(0, 1);
    setOtp((prev) => {
      const copy = [...prev];
      copy[index] = nextValue;
      return copy;
    });
    if (nextValue && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, event) => {
    if (event.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOtp = async () => {
    const code = otp.join("");
    if (code.length !== 6) {
      setError("Please enter the 6-digit reset code.");
      return;
    }
    if (!email.trim()) {
      setError("Email is required.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const verifyPromise = fetch(`${API_BASE}/api/auth/reset-password/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), otp: code }),
      }).then(async (res) => {
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j?.message || "Invalid OTP.");
        return j;
      });
      notify.promise(verifyPromise, {
        loading: "Verifying code...",
        success: "Code verified.",
        error: "Invalid or expired code.",
      });
      await verifyPromise;

      navigate(
        `/reset-password?email=${encodeURIComponent(email.trim())}&otp=${encodeURIComponent(code)}`,
      );
    } catch (err) {
      setError(err?.message || "Failed to verify code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link
          to="/login"
          onClick={(e) => {
            if (!confirmCancel()) e.preventDefault();
          }}
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
            Enter your email and we will send a reset code.
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
                  If the email exists, we will send a one-time code.
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
                {loading ? "Sending..." : "Send Reset Code"}
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
                  If <span className="font-medium">{email.trim()}</span> is registered,
                  you will receive a reset code shortly.
                </p>
              </div>
              {devOtp ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  <p className="font-semibold">Development OTP Fallback</p>
                  <p className="mt-1">
                    Your code is <span className="font-mono">{devOtp}</span>
                    {devOtpExpiry ? ` (expires in ${devOtpExpiry} minutes)` : ""}.
                  </p>
                </div>
              ) : null}

              <div>
                <p className="text-sm text-gray-700 mb-3">
                  Enter the 6-digit reset code:
                </p>
                <div className="flex gap-2.5 justify-center">
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => {
                        otpRefs.current[index] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      className="h-11 w-10 text-center text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={loading}
                    />
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={handleVerifyOtp}
                disabled={loading}
                className="inline-flex items-center justify-center w-full px-4 py-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed mb-3"
              >
                Continue to Reset Password
              </button>

              <button
                type="button"
                onClick={() => {
                  setSent(false);
                  setEmail("");
                  setError(null);
                  setOtp(["", "", "", "", "", ""]);
                  setDevOtp("");
                  setDevOtpExpiry(null);
                }}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors text-sm"
              >
                Send Another Code
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
