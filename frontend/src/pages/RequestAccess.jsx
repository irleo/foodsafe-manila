import axios from "axios";
import { useMemo, useState } from "react";
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

const MAX_REASON = 500;

const RequestAccess = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [submitted, setSubmitted] = useState(false);

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

  const passwordsMatch = useMemo(() => {
    if (!form.password || !form.confirmPassword) return true;
    return form.password === form.confirmPassword;
  }, [form.password, form.confirmPassword]);

  const canSubmit = useMemo(() => {
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
      passwordsMatch &&
      form.reason.length <= MAX_REASON &&
      !loading &&
      !submitted
    );
  }, [form, passwordsMatch, loading, submitted]);

  const setField = (key) => (e) => {
    setError(null);
    const value = e.target.value;
    setForm((prev) => ({
      ...prev,
      [key]: key === "reason" ? value.slice(0, MAX_REASON) : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (loading || submitted) return;
    setError(null);

    if (!passwordsMatch) {
      setError("Passwords do not match.");
      return;
    }

    if (form.reason.length > MAX_REASON) {
      setError(`Reason must be ${MAX_REASON} characters or less.`);
      return;
    }

    setLoading(true);

    let success = false;

    try {
      const payload = {
        username: form.username,
        email: form.email,
        password: form.password,
        organization: form.organization,
        position: form.position,
        reason: form.reason,
      };

      const requestPromise = axios.post("/api/auth/request-access", payload, {
        withCredentials: true,
      });

      await notify.promise(requestPromise, {
        loading: "Requesting access…",
        success: (r) => r?.data?.message || "Request submitted successfully!",
        error: (e) => e?.response?.data?.message || "Request failed.",
      });

      // Only reached if request succeeded
      success = true;
      setSubmitted(true);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }

    // Navigate ONLY if success is true
    if (success) {
      setTimeout(() => {
        navigate("/login");
      }, 2000);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="flex items-center justify-center mb-6">
            <div className="bg-blue-600 p-3 rounded-xl">
              <IdentificationIcon className="w-8 h-8 text-white" />
            </div>
          </div>

          <h1 className="text-center mb-2 text-2xl font-semibold">
            Request Access
          </h1>
          <p className="text-center text-gray-600 mb-8">
            Disease Monitoring System - DOH Philippines
          </p>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-800 font-semibold">
              For Health Officials & Researchers Only
            </p>
            <p className="text-sm text-blue-700 mt-2">
              This registration is for DOH personnel, health analysts, and
              authorized researchers who need access to the administrative
              dashboard for data analytics and outbreak monitoring.
            </p>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-green-800 font-semibold">
              Are you a citizen looking for health alerts?
            </p>
            <p className="text-sm text-green-700 mt-2">
              Please download the <strong>DOH Disease Alert Mobile App</strong>{" "}
              from Google Play or App Store to receive early warnings and
              outbreak notifications in your area.
            </p>
          </div>

          {error && (
            <div className="mb-5 rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <form
            className={`space-y-5 ${loading || submitted ? "pointer-events-none opacity-60" : ""}`}
            onSubmit={handleSubmit}
            autoComplete="off"
          >
            {/* Personal Information */}
            <div className="space-y-4">
              <h2 className="text-sm font-medium text-gray-700">
                Personal Information
              </h2>

              {/* Full Name */}
              <div>
                <label
                  htmlFor="username"
                  className="block mb-2 text-sm text-gray-700"
                >
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

              {/* Email */}
              <div>
                <label
                  htmlFor="email"
                  className="block mb-2 text-sm text-gray-700"
                >
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

              {/* Passwords */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Password */}
                <div>
                  <label
                    htmlFor="password"
                    className="block mb-2 text-sm text-gray-700"
                  >
                    Password <span className="text-red-500">*</span>
                  </label>

                  <div className="relative">
                    <LockClosedIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      className="w-full pl-10 pr-12 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all border-gray-300"
                      placeholder="••••••••"
                      value={form.password}
                      onChange={setField("password")}
                      disabled={loading}
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      onClick={() => setShowPassword((v) => !v)}
                      disabled={loading}
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showPassword ? (
                        <EyeSlashIcon className="w-5 h-5" />
                      ) : (
                        <EyeIcon className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
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
                      placeholder="••••••••"
                      value={form.confirmPassword}
                      onChange={setField("confirmPassword")}
                      disabled={loading}
                      required
                      minLength={6}
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

            {/* Organization Information */}
            <div className="space-y-4 pt-4 border-t border-gray-200">
              <h2 className="text-sm font-medium text-gray-700">
                Organization Information
              </h2>

              <div>
                <label
                  htmlFor="organization"
                  className="block mb-2 text-sm text-gray-700"
                >
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
                <label
                  htmlFor="position"
                  className="block mb-2 text-sm text-gray-700"
                >
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
                <label
                  htmlFor="reason"
                  className="block mb-2 text-sm text-gray-700"
                >
                  Reason for Access Request{" "}
                  <span className="text-red-500">*</span>
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

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading && (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {loading ? "Submitting..." : "Submit Access Request"}
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
              reviewed by DOH administrators. This system contains sensitive
              health data and access is granted only to authorized personnel.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RequestAccess;
