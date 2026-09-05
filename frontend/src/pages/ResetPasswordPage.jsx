import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, Lock } from "lucide-react";
import { notify } from "../utils/toast";
import AuthPageLayout from "../layouts/AuthPageLayout";
import { getErrorMessage } from "../utils/errors";
import {
  getPasswordValidationResults,
  validatePassword,
} from "../utils/passwordValidation";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const initialEmail = useMemo(() => params.get("email") || "", [params]);
  const initialOtp = useMemo(() => params.get("otp") || "", [params]);

  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  const [show1, setShow1] = useState(false);
  const [show2, setShow2] = useState(false);

  const [form, setForm] = useState({
    email: initialEmail,
    otp: initialOtp,
    password: "",
    confirm: "",
  });

  const passwordsMatch =
    !form.password || !form.confirm ? true : form.password === form.confirm;
  const passwordValidation = useMemo(
    () => validatePassword(form.password),
    [form.password],
  );
  const passwordRules = useMemo(
    () => getPasswordValidationResults(form.password),
    [form.password],
  );

  const handleReset = async (e) => {
    e.preventDefault();
    setError(null);

    if (!passwordsMatch) {
      setError("Passwords do not match.");
      return;
    }
    if (!passwordValidation.isValid) {
      setError(
        `Password must include: ${passwordValidation.errors.join(", ")}.`,
      );
      return;
    }

    const payload = {
      email: form.email.trim(),
      otp: form.otp.trim(),
      password: form.password,
    };

    try {
      setLoading(true);
      const resetPromise = fetch(
        `${API_BASE}/api/auth/reset-password/complete`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      ).then(async (res) => {
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j?.message || "Failed to reset password.");
        return j;
      });
      notify.promise(resetPromise, {
        loading: "Resetting password...",
        success: "Password updated.",
        error: "Failed to reset password.",
      });
      await resetPromise;

      setDone(true);
    } catch (err) {
      setError(getErrorMessage(err, "The password could not be reset."));
    } finally {
      setLoading(false);
    }
  };

  const hasInProgress =
    form.password.length > 0 || form.confirm.length > 0 || done;

  const confirmCancel = () =>
    !hasInProgress ||
    window.confirm(
      "This password reset transaction will be cancelled. Do you want to continue?",
    );

  return (
    <AuthPageLayout
      title="Set a new password"
      description="Choose a strong password you haven't used for this account before."
      backTo="/forgot-password"
      backLabel="Back to reset request"
      onBack={(e) => {
        if (!confirmCancel()) e.preventDefault();
      }}
    >
          {!form.email.trim() || !form.otp.trim() ? (
            <div className="mb-4 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 text-sm">
              Reset session is missing. Please request and verify a code first.
            </div>
          ) : null}

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {done ? (
            <div className="space-y-6">
              <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                <p className="font-semibold">Password updated</p>
                <p className="mt-1">
                  You can now log in with your new password.
                </p>
              </div>

              <Link
                to="/login"
                className="block w-full text-center bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Go to Login
              </Link>
            </div>
          ) : !form.email.trim() || !form.otp.trim() ? (
            <Link
              to="/forgot-password"
              className="block w-full text-center bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Back to Forgot Password
            </Link>
          ) : (
            <form
              className="space-y-6"
              onSubmit={handleReset}
              autoComplete="off"
            >
              <div>
                <label
                  className="block mb-2 text-sm text-gray-700"
                  htmlFor="password"
                >
                  New Password
                </label>

                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="password"
                    type={show1 ? "text" : "password"}
                    className={`w-full pl-10 pr-12 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                      form.password && !passwordValidation.isValid
                        ? "border-red-300"
                        : "border-gray-300"
                    }`}
                    placeholder="Enter a new password"
                    value={form.password}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, password: e.target.value }))
                    }
                    disabled={loading}
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShow1((v) => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    disabled={loading}
                    aria-label={show1 ? "Hide password" : "Show password"}
                  >
                    {show1 ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

               {/* Password Rules */}
              <p className="text-xs text-gray-500 -mt-4">
                Password must have{" "}
                {passwordRules.map((rule, index) => (
                  <span
                    key={rule.id}
                    className={rule.isMet ? "text-green-700" : "text-gray-500"}
                  >
                    {rule.label.toLowerCase()}
                    {index < passwordRules.length - 1 ? ", " : "."}
                  </span>
                ))}
              </p>

              <div>
                <label
                  className="block mb-2 text-sm text-gray-700 "
                  htmlFor="confirm"
                >
                  Confirm Password
                </label>

                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="confirm"
                    type={show2 ? "text" : "password"}
                    className={`w-full pl-10 pr-12 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                      passwordsMatch ? "border-gray-300" : "border-red-300"
                    }`}
                    placeholder="Confirm new password"
                    value={form.confirm}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, confirm: e.target.value }))
                    }
                    disabled={loading}
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShow2((v) => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    disabled={loading}
                    aria-label={show2 ? "Hide password" : "Show password"}
                  >
                    {show2 ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>

                {!passwordsMatch && (
                  <p className="mt-2 text-xs text-red-600">
                    Passwords do not match.
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={
                  loading || !passwordValidation.isValid || !passwordsMatch
                }
                className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading && (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                {loading ? "Saving..." : "Reset Password"}
              </button>

              <div className="text-center text-sm text-gray-600">
                <Link to="/login" className="text-blue-600 hover:text-blue-700">
                  Back to Login
                </Link>
              </div>
            </form>
          )}
    </AuthPageLayout>
  );
}
