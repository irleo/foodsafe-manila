import axios from "axios";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeftIcon,
  BuildingOffice2Icon,
  EnvelopeIcon,
  EyeIcon,
  EyeSlashIcon,
  IdentificationIcon,
  LockClosedIcon,
  UserIcon,
} from "@heroicons/react/24/outline";
import { notify } from "../utils/toast";
import {
  getPasswordValidationResults,
  validatePassword,
} from "../utils/passwordValidation";
import logo from "../../../mobile/assets/foodsafe_logo.png";

const MAX_REASON = 300;
const OTP_RESEND_COOLDOWN_SECONDS = 180;

const RequestAccess = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [submitted, setSubmitted] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [showCancelOtpConfirm, setShowCancelOtpConfirm] = useState(false);
  const [accessOtpDigits, setAccessOtpDigits] = useState(["", "", "", "", "", ""]);
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpRefs = useRef([]);
  const [devOtp, setDevOtp] = useState("");
  const [devOtpExpiry, setDevOtpExpiry] = useState(null);

  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    organization: "",
    position: "",
    reason: "",
  });

  const reasonCount = form.reason.length;
  const accessOtp = accessOtpDigits.join("");

  const passwordsMatch = useMemo(() => {
    if (!form.password || !form.confirmPassword) return true;
    return form.password === form.confirmPassword;
  }, [form.password, form.confirmPassword]);

  const passwordValidation = useMemo(
    () => validatePassword(form.password),
    [form.password],
  );
  const passwordRules = useMemo(
    () => getPasswordValidationResults(form.password),
    [form.password],
  );

  const canRequestOtp = useMemo(() => {
    const requiredFilled =
      form.username.trim() &&
      form.email.trim() &&
      form.password &&
      form.confirmPassword &&
      form.organization.trim() &&
      form.position.trim() &&
      form.reason.trim();

    return (
      Boolean(requiredFilled) &&
      passwordValidation.isValid &&
      passwordsMatch &&
      form.reason.length <= MAX_REASON &&
      !loading &&
      !submitted
    );
  }, [form, passwordValidation.isValid, passwordsMatch, loading, submitted]);
  const canSubmit = canRequestOtp && otpSent && accessOtp.trim().length === 6;

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const setField = (key) => (e) => {
    setError(null);
    const value = e.target.value;
    if (key === "email") {
      setOtpSent(false);
      setOtpModalOpen(false);
      setShowCancelOtpConfirm(false);
      setAccessOtpDigits(["", "", "", "", "", ""]);
      setDevOtp("");
      setDevOtpExpiry(null);
      setResendCooldown(0);
    }
    setForm((prev) => ({
      ...prev,
      [key]: key === "reason" ? value.slice(0, MAX_REASON) : value,
    }));
  };

  const handleOtpChange = (index, rawValue) => {
    const nextValue = String(rawValue || "").replace(/\D+/g, "").slice(0, 1);
    setAccessOtpDigits((prev) => {
      const copy = [...prev];
      copy[index] = nextValue;
      return copy;
    });
    if (nextValue && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index, event) => {
    if (event.key === "Backspace" && !accessOtpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const buildPayload = () => ({
    username: form.username.trim(),
    email: form.email.trim(),
    password: form.password,
    organization: form.organization.trim(),
    position: form.position.trim(),
    reason: form.reason.trim(),
  });

  const sendAccessOtp = async () => {
    const payload = buildPayload();
    const otpPromise = axios.post("/api/auth/request-access/send-otp", payload, {
      withCredentials: true,
    });
    notify.promise(otpPromise, {
      loading: "Sending verification code...",
      success: (r) => r?.data?.message || "Verification code sent.",
      error: (e) => e?.response?.data?.message || "Failed to send code.",
    });
    const otpResult = await otpPromise;

    setOtpSent(true);
    setOtpModalOpen(true);
    setResendCooldown(OTP_RESEND_COOLDOWN_SECONDS);
    setAccessOtpDigits(["", "", "", "", "", ""]);
    setDevOtp(
      otpResult?.data?.devFallback ? String(otpResult?.data?.debugOtp || "") : "",
    );
    setDevOtpExpiry(
      otpResult?.data?.devFallback &&
        Number.isFinite(Number(otpResult?.data?.debugExpiresMinutes))
        ? Number(otpResult.data.debugExpiresMinutes)
        : null,
    );
  };

  const handleSendOtp = async () => {
    if (!canRequestOtp || loading || submitted) return;

    if (!passwordsMatch) {
      setError("Passwords do not match.");
      return;
    }
    if (!passwordValidation.isValid) {
      setError(`Password must include: ${passwordValidation.errors.join(", ")}.`);
      return;
    }
    if (form.reason.length > MAX_REASON) {
      setError(`Reason must be ${MAX_REASON} characters or less.`);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await sendAccessOtp();
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.message || "Failed to send code.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndSubmit = async () => {
    if (loading || submitted) return;

    if (accessOtp.trim().length !== 6) {
      setError("Please enter the 6-digit email verification code.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const payload = { ...buildPayload(), accessOtp: accessOtp.trim() };
      const requestPromise = axios.post("/api/auth/request-access", payload, {
        withCredentials: true,
      });
      notify.promise(requestPromise, {
        loading: "Requesting access...",
        success: (r) => r?.data?.message || "Request submitted successfully!",
        error: (e) => e?.response?.data?.message || "Request failed.",
      });
      await requestPromise;

      setSubmitted(true);
      setOtpModalOpen(false);
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.message || "Request failed.");
    } finally {
      setLoading(false);
    }
  };

  const cooldownLabel = `${Math.floor(resendCooldown / 60)}:${String(
    resendCooldown % 60,
  ).padStart(2, "0")}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-blue-600 rounded-2xl">
        <div className="flex items-center justify-center">
          <div className="p-8">
            <img
              src={logo}
              className="h-14 sm:h-16 w-auto object-contain mx-auto select-none"
              alt="FoodSafe Manila"
              draggable="false"
              decoding="async"
            />
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-800 font-semibold">
              For Health Officials & Researchers Only
            </p>
            <p className="text-sm text-blue-700 mt-2">
              This registration is for MHD personnel, health analysts, and
              authorized researchers who need access to the administrative
              dashboard for data analytics and outbreak monitoring.
            </p>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-green-800 font-semibold">
              Are you a citizen looking for health alerts?
            </p>
            <p className="text-sm text-green-700 mt-2">
              Please download the <strong>Foodsafe Manila Mobile App</strong>{" "}
              from Google Play to receive early warnings and outbreak
              notifications in your area.
            </p>
          </div>

          {otpSent && !submitted && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-800 font-semibold">
                Verify your email address
              </p>
              <p className="text-sm text-blue-700 mt-2">
                Enter the 6-digit code sent to {form.email.trim()} before
                submitting your access request.
              </p>
              {devOtp && (
                <p className="mt-2 text-xs text-blue-800">
                  Development OTP: <span className="font-semibold">{devOtp}</span>
                  {devOtpExpiry ? ` (expires in ${devOtpExpiry} minutes)` : ""}
                </p>
              )}
            </div>
          )}

          {error && (
            <div className="mb-5 rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <form
            className={`space-y-5 ${loading || submitted ? "pointer-events-none opacity-60" : ""}`}
            autoComplete="off"
            onSubmit={(e) => e.preventDefault()}
          >
            <div className="space-y-4">
              <h2 className="text-sm font-medium text-gray-700">
                Personal Information
              </h2>

              <div>
                <label htmlFor="username" className="block mb-2 text-sm text-gray-700">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="username"
                    name="username"
                    type="text"
                    className="w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all border-gray-300"
                    placeholder="Juan Dela Cruz"
                    value={form.username}
                    onChange={setField("username")}
                    disabled={loading}
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="email" className="block mb-2 text-sm text-gray-700">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <EnvelopeIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    className="w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all border-gray-300"
                    placeholder="your.email@organization.gov.ph"
                    value={form.email}
                    onChange={setField("email")}
                    disabled={loading}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 -mb-3">
                <div>
                  <label htmlFor="password" className="block mb-2 text-sm text-gray-700">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <LockClosedIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      className={`w-full pl-10 pr-12 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                        form.password && !passwordValidation.isValid
                          ? "border-red-400"
                          : "border-gray-300"
                      }`}
                      placeholder="********"
                      value={form.password}
                      onChange={setField("password")}
                      disabled={loading}
                      required
                      minLength={8}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      onClick={() => setShowPassword((v) => !v)}
                      disabled={loading}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeSlashIcon className="w-5 h-5" />
                      ) : (
                        <EyeIcon className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="block mb-2 text-sm text-gray-700"
                  >
                    Confirm Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <LockClosedIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      className={`w-full pl-10 pr-12 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                        !passwordsMatch ? "border-red-400" : "border-gray-300"
                      }`}
                      placeholder="********"
                      value={form.confirmPassword}
                      onChange={setField("confirmPassword")}
                      disabled={loading}
                      required
                      minLength={8}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      disabled={loading}
                      aria-label={
                        showConfirmPassword
                          ? "Hide confirm password"
                          : "Show confirm password"
                      }
                    >
                      {showConfirmPassword ? (
                        <EyeSlashIcon className="w-5 h-5" />
                      ) : (
                        <EyeIcon className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                  {!passwordsMatch && (
                    <p className="mt-2 text-xs text-red-600">
                      Passwords do not match.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <p className="text-xs text-gray-500">
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

            <div className="space-y-4 pt-4 border-t border-gray-200">
              <h2 className="text-sm font-medium text-gray-700">
                Organization Information
              </h2>

              <div>
                <label htmlFor="organization" className="block mb-2 text-sm text-gray-700">
                  Organization <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <BuildingOffice2Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="organization"
                    name="organization"
                    type="text"
                    className="w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all border-gray-300"
                    placeholder="Department of Health, WHO, etc."
                    value={form.organization}
                    onChange={setField("organization")}
                    disabled={loading}
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="position" className="block mb-2 text-sm text-gray-700">
                  Position/Title <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <IdentificationIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="position"
                    name="position"
                    type="text"
                    className="w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all border-gray-300"
                    placeholder="Health Analyst, Researcher, etc."
                    value={form.position}
                    onChange={setField("position")}
                    disabled={loading}
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="reason" className="block mb-2 text-sm text-gray-700">
                  Reason for Access Request <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="reason"
                  name="reason"
                  rows={4}
                  className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none border-gray-300"
                  placeholder="Please describe your role and why you need access to this system..."
                  value={form.reason}
                  onChange={setField("reason")}
                  disabled={loading}
                  required
                />
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-gray-500 ml-auto">
                    {reasonCount}/{MAX_REASON}
                  </p>
                </div>
              </div>
            </div>

            {otpSent && (
              <div className="space-y-2 pt-4 border-t border-gray-200">
                <label className="block text-sm text-gray-700">
                  Email Verification Code <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  className="w-full px-4 py-3 border rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                  onClick={() => setOtpModalOpen(true)}
                  disabled={loading}
                >
                  Enter 6-digit code
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={otpSent ? () => setOtpModalOpen(true) : handleSendOtp}
              disabled={otpSent ? !canSubmit : !canRequestOtp}
              className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading && (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {loading
                ? otpSent
                  ? "Opening verification..."
                  : "Sending code..."
                : otpSent
                  ? "Verify Code to Submit"
                  : "Send Verification Code"}
            </button>

            <div className="text-center">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
              >
                <ArrowLeftIcon className="w-4 h-4" />
                Back to Login
              </Link>
            </div>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-200 text-xs text-gray-600 text-center">
            <p>
              By submitting this form, you agree that your information will be
              reviewed by MHD administrators. This system contains sensitive
              health data and access is granted only to authorized personnel.
            </p>
          </div>
        </div>
      </div>

      {otpModalOpen && otpSent && !submitted && (
        <div className="fixed inset-0 z-[1000] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl p-6">
            <h3 className="text-lg font-semibold text-center">Email Verification</h3>
            <p className="text-sm text-gray-600 text-center mt-1">
              Enter the 6-digit code sent to {form.email.trim()}.
            </p>
            {devOtp && (
              <p className="mt-2 text-xs text-blue-800 text-center">
                Development OTP: <span className="font-semibold">{devOtp}</span>
                {devOtpExpiry ? ` (expires in ${devOtpExpiry} minutes)` : ""}
              </p>
            )}
            <div className="mt-4 flex gap-2.5 justify-center">
              {accessOtpDigits.map((digit, index) => (
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
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                className="px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-sm"
                onClick={() => setShowCancelOtpConfirm(true)}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleVerifyAndSubmit}
                disabled={loading}
              >
                Verify & Submit
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
                  await sendAccessOtp();
                } catch (err) {
                  console.error(err);
                  setError(err?.response?.data?.message || "Failed to send code.");
                } finally {
                  setLoading(false);
                }
              }}
            >
              {resendCooldown > 0 ? `Resend code in ${cooldownLabel}` : "Resend code"}
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
              another code.
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
                  setOtpModalOpen(false);
                  setOtpSent(false);
                  setAccessOtpDigits(["", "", "", "", "", ""]);
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
    </div>
  );
};

export default RequestAccess;
