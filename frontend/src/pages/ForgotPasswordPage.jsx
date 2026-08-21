import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail } from "lucide-react";
import { notify } from "../utils/toast";
import AuthPageLayout from "../layouts/AuthPageLayout";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
const OTP_RESEND_COOLDOWN_SECONDS = 180;

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [showCancelOtpConfirm, setShowCancelOtpConfirm] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [error, setError] = useState(null);
  const [devOtp, setDevOtp] = useState("");
  const [devOtpExpiry, setDevOtpExpiry] = useState(null);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const otpRefs = useRef([]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const requestResetOtp = async (normalizedEmail) => {
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
    return sendPromise;
  };

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
      const result = await requestResetOtp(normalizedEmail);

      setDevOtp(result?.devFallback ? String(result?.debugOtp || "") : "");
      setDevOtpExpiry(
        result?.devFallback && Number.isFinite(Number(result?.debugExpiresMinutes))
          ? Number(result.debugExpiresMinutes)
          : null,
      );
      setSent(true);
      setShowOtpModal(true);
      setResendCooldown(OTP_RESEND_COOLDOWN_SECONDS);
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
    <>
      <AuthPageLayout
        title="Reset your password"
        description="Enter your email address and we'll send you a one-time reset code."
        backTo="/login"
        backLabel="Back to login"
        onBack={(e) => {
          if (!confirmCancel()) e.preventDefault();
        }}
      >
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
                <p className="font-semibold">Code Sent</p>
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

              <button
                type="button"
                onClick={() => setShowOtpModal(true)}
                disabled={loading}
                className="inline-flex items-center justify-center w-full px-4 py-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed mb-3"
              >
                Enter OTP Code
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
      </AuthPageLayout>

      {showOtpModal && (
        <div className="fixed inset-0 z-[1000] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl p-6">
            <h2 className="text-lg font-semibold text-center">Enter OTP Code</h2>
            <p className="text-sm text-gray-600 text-center mt-1">
              Enter the 6-digit code before continuing.
            </p>
            <div className="mt-5 grid grid-cols-6 gap-1.5">
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
                  className="h-11 min-w-0 w-full text-center text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={loading}
                />
              ))}
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setShowCancelOtpConfirm(true)}
                className="px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-sm"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleVerifyOtp}
                className="px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading}
              >
                Verify OTP
              </button>
            </div>
            <button
              type="button"
              className="mt-3 w-full text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50"
              disabled={loading || resendCooldown > 0}
              onClick={async () => {
                if (resendCooldown > 0) return;
                setLoading(true);
                setError(null);
                try {
                  const result = await requestResetOtp(email.trim());
                  setDevOtp(result?.devFallback ? String(result?.debugOtp || "") : "");
                  setDevOtpExpiry(
                    result?.devFallback &&
                      Number.isFinite(Number(result?.debugExpiresMinutes))
                      ? Number(result.debugExpiresMinutes)
                      : null,
                  );
                  setResendCooldown(OTP_RESEND_COOLDOWN_SECONDS);
                  setOtp(["", "", "", "", "", ""]);
                } catch (err) {
                  setError(err?.message || "Failed to resend code.");
                } finally {
                  setLoading(false);
                }
              }}
            >
              {resendCooldown > 0
                ? `Resend code in ${Math.floor(resendCooldown / 60)}:${String(
                    resendCooldown % 60,
                  ).padStart(2, "0")}`
                : "Resend code"}
            </button>
          </div>
        </div>
      )}

      {showCancelOtpConfirm && (
        <div className="fixed inset-0 z-[1010] bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl p-6">
            <h3 className="text-lg font-semibold">Cancel Verification?</h3>
            <p className="text-sm text-gray-600 mt-2">
              Your OTP transaction will be cancelled and you will need to request
              a new reset code.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                className="px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-sm"
                onClick={() => setShowCancelOtpConfirm(false)}
              >
                Keep Editing
              </button>
              <button
                type="button"
                className="px-3 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 text-sm"
                onClick={() => {
                  setShowCancelOtpConfirm(false);
                  setShowOtpModal(false);
                  setSent(false);
                  setOtp(["", "", "", "", "", ""]);
                  setDevOtp("");
                  setDevOtpExpiry(null);
                  setResendCooldown(0);
                }}
              >
                Cancel OTP
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
