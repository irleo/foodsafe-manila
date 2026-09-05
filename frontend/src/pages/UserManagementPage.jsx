import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "../context/AuthContext";
import useAxiosPrivate from "../hooks/useAxiosPrivate";
import { formatStatusLabel } from "../utils/formatStatusLabel";
import { getErrorMessage } from "../utils/errors";

const PAGE_LIMIT = 10;
const ASSIGNABLE_ROLES = new Set(["cesu", "surveillance_team"]);

function statusBadgeClass(status) {
  if (status === "approved") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "suspended") return "border-gray-300 bg-gray-100 text-gray-700";
  if (status === "rejected") return "border-red-200 bg-red-50 text-red-700";
  return "border-amber-200 bg-amber-50 text-amber-800";
}

function formatLastLogin(value) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Never";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function Pagination({ page, totalPages, onChange }) {
  return (
    <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-5 py-4">
      <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)} className="min-h-10 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40">
        Previous
      </button>
      <span className="px-2 text-sm text-gray-600">Page {page} of {totalPages}</span>
      <button type="button" disabled={page >= totalPages} onClick={() => onChange(page + 1)} className="min-h-10 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40">
        Next
      </button>
    </div>
  );
}

export default function UserManagement() {
  const { auth } = useAuth();
  const axiosPrivate = useAxiosPrivate();
  const [requests, setRequests] = useState([]);
  const [managedUsers, setManagedUsers] = useState([]);
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0, suspended: 0 });
  const [requestStatus, setRequestStatus] = useState("pending");
  const [requestPage, setRequestPage] = useState(1);
  const [requestTotalPages, setRequestTotalPages] = useState(1);
  const [usersPage, setUsersPage] = useState(1);
  const [usersTotalPages, setUsersTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [error, setError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [accessSelections, setAccessSelections] = useState({});
  const [editTarget, setEditTarget] = useState(null);

  const fetchRequests = useCallback(async () => {
    const params = new URLSearchParams({ page: String(requestPage), limit: String(PAGE_LIMIT), status: requestStatus });
    const response = await axiosPrivate.get(`/api/users?${params.toString()}`);
    setRequests(response.data.users || []);
    setRequestTotalPages(response.data.totalPages || 1);
  }, [axiosPrivate, requestPage, requestStatus]);

  const fetchManagedUsers = useCallback(async () => {
    const params = new URLSearchParams({ page: String(usersPage), limit: String(PAGE_LIMIT), status: "managed" });
    const response = await axiosPrivate.get(`/api/users?${params.toString()}`);
    setManagedUsers(response.data.users || []);
    setUsersTotalPages(response.data.totalPages || 1);
  }, [axiosPrivate, usersPage]);

  const fetchStats = useCallback(async () => {
    const response = await axiosPrivate.get("/api/users/stats");
    setStats(response.data);
  }, [axiosPrivate]);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([fetchRequests(), fetchManagedUsers(), fetchStats()]);
      setError("");
    } catch (requestError) {
      setError(getErrorMessage(requestError, "User data could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, [fetchManagedUsers, fetchRequests, fetchStats]);

  useEffect(() => {
    if (auth?.accessToken) refreshAll();
  }, [auth?.accessToken, refreshAll]);

  const selectedAccessFor = useCallback(
    (user) => accessSelections[user._id] || {
      role: ASSIGNABLE_ROLES.has(user.role)
        ? user.role
        : ASSIGNABLE_ROLES.has(user.requestedRole)
          ? user.requestedRole
          : "cesu",
      canAccessPatientIdentity: user.canAccessPatientIdentity === true,
    },
    [accessSelections],
  );

  const setSelectedAccess = (user, changes) => {
    setAccessSelections((current) => ({
      ...current,
      [user._id]: { ...selectedAccessFor(user), ...changes },
    }));
  };

  const visibleRequests = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return requests;
    return requests.filter((user) =>
      [user.username, user.email, user.requestedRole, user.status]
        .filter(Boolean).join(" ").toLowerCase().includes(term),
    );
  }, [requests, search]);

  const visibleManagedUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return managedUsers;
    return managedUsers.filter((user) =>
      [user.username, user.email, user.role, user.status]
        .filter(Boolean).join(" ").toLowerCase().includes(term),
    );
  }, [managedUsers, search]);

  const confirmManualAffiliation = (user) =>
    user.emailReviewStatus !== "manual_review_required" ||
    window.confirm("This account does not use a .gov.ph address. Confirm that you manually verified the user's affiliation and authorization.");

  const changeStatus = async (user, status) => {
    if (user.role === "admin" || !confirmManualAffiliation(user)) return;
    const isInitialDecision = ["pending", "rejected"].includes(user.status);
    const access = isInitialDecision
      ? {
          role: user.requestedRole,
          canAccessPatientIdentity: false,
        }
      : selectedAccessFor(user);
    if (status === "approved" && !ASSIGNABLE_ROLES.has(access.role)) {
      setError("This legacy request has no selected role and cannot be approved. Ask the applicant to submit a new request.");
      return;
    }
    try {
      setActionLoadingId(user._id);
      await axiosPrivate.patch(`/api/users/${user._id}/status`, {
        status,
        ...(status === "approved" ? access : {}),
        manualAffiliationConfirmed: user.emailReviewStatus === "manual_review_required",
      });
      setInfoMessage(
        status === "approved"
          ? user.status === "suspended" ? "User account reactivated." : "Access request approved."
          : status === "suspended" ? "User account suspended." : "Access request rejected.",
      );
      await refreshAll();
    } catch (requestError) {
      setError(getErrorMessage(requestError, "The user status could not be updated."));
    } finally {
      setActionLoadingId(null);
    }
  };

  const saveAccess = async () => {
    if (!editTarget || !confirmManualAffiliation(editTarget)) return;
    try {
      setActionLoadingId(editTarget._id);
      await axiosPrivate.patch(`/api/users/${editTarget._id}/access`, {
        ...selectedAccessFor(editTarget),
        manualAffiliationConfirmed: editTarget.emailReviewStatus === "manual_review_required",
      });
      setEditTarget(null);
      setInfoMessage("User role updated successfully.");
      await refreshAll();
    } catch (requestError) {
      setError(getErrorMessage(requestError, "The user role could not be updated."));
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
        <p className="mt-1 text-gray-600">Review access requests and manage system roles.</p>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {infoMessage && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{infoMessage}</div>}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[["Pending", stats.pending, "text-amber-600"], ["Active", stats.approved, "text-blue-600"], ["Suspended", stats.suspended, "text-gray-600"], ["Rejected", stats.rejected, "text-red-600"]].map(([label, count, color]) => (
          <div key={label} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-600">{label}</p>
            <p className={`mt-2 text-3xl font-semibold ${color}`}>{count || 0}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search visible users by name, email, role, or status..." className="min-h-11 w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" />
        </div>
      </div>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-gray-200 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">Access Requests</h2>
            <p className="mt-1 text-sm text-gray-600">Review the role selected by the applicant before accepting or rejecting access.</p>
          </div>
          <div className="inline-flex self-start rounded-lg border border-gray-300 bg-gray-50 p-1">
            {["pending", "rejected"].map((status) => (
              <button key={status} type="button" onClick={() => { setRequestStatus(status); setRequestPage(1); }} className={`rounded-md px-3 py-2 text-sm font-medium ${requestStatus === status ? "bg-blue-600 text-white shadow-sm" : "text-gray-600 hover:bg-white"}`}>
                {formatStatusLabel(status)}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[850px] w-full text-left text-sm">
            <thead className="bg-blue-50 text-xs uppercase tracking-wide text-blue-900">
              <tr><th className="px-5 py-3">Username</th><th className="px-5 py-3">Email</th><th className="px-5 py-3">Role</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Requested</th><th className="px-5 py-3 text-right">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visibleRequests.map((user) => {
                const busy = actionLoadingId === user._id;
                return (
                  <tr key={user._id} className="hover:bg-blue-50/30">
                    <td className="px-5 py-4 font-medium text-gray-900">{user.username}</td>
                    <td className="px-5 py-4 text-gray-600">{user.email}</td>
                    <td className="px-5 py-4">
                      <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                        {formatStatusLabel(user.requestedRole, "Not specified")}
                      </span>
                    </td>
                    <td className="px-5 py-4"><span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusBadgeClass(user.status)}`}>{formatStatusLabel(user.status)}</span></td>
                    <td className="px-5 py-4 text-gray-600">{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}</td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <button type="button" disabled={busy || !ASSIGNABLE_ROLES.has(user.requestedRole)} onClick={() => changeStatus(user, "approved")} title={!ASSIGNABLE_ROLES.has(user.requestedRole) ? "This legacy request has no selected role." : undefined} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"><CheckIcon className="h-4 w-4" />{user.status === "rejected" ? "Approve" : "Accept"}</button>
                        {user.status === "pending" && <button type="button" disabled={busy} onClick={() => changeStatus(user, "rejected")} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"><XMarkIcon className="h-4 w-4" /> Reject</button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!loading && visibleRequests.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-500">No {requestStatus} access requests.</td></tr>}
            </tbody>
          </table>
        </div>
        <Pagination page={requestPage} totalPages={requestTotalPages} onChange={setRequestPage} />
      </section>

      <div className="flex items-center gap-4 py-4" aria-hidden="true">
        <div className="h-px flex-1 bg-gray-300" />
        <span className="rounded-full border border-gray-300 bg-gray-100 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-gray-600">
          List of Users
        </span>
        <div className="h-px flex-1 bg-gray-300" />
      </div>

      <section className="overflow-hidden rounded-xl border border-blue-200 bg-white shadow-sm ring-4 ring-blue-50">
        <div className="border-b border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900">Users</h2>
          <p className="mt-1 text-sm text-gray-600">Active and suspended dashboard accounts. System administrators cannot be modified.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[900px] w-full text-left text-sm">
            <thead className="bg-blue-50 text-xs uppercase tracking-wide text-blue-900">
              <tr><th className="px-5 py-3">Username</th><th className="px-5 py-3">Email</th><th className="px-5 py-3">Role</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Last Login</th><th className="px-5 py-3 text-right">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visibleManagedUsers.map((user) => {
                const isAdmin = user.role === "admin";
                const isSuspended = user.status === "suspended";
                const busy = actionLoadingId === user._id;
                return (
                  <tr key={user._id} className={isAdmin ? "bg-gray-100 text-gray-500" : "hover:bg-blue-50/30"}>
                    <td className="px-5 py-4 font-medium">{user.username}</td><td className="px-5 py-4">{user.email}</td>
                    <td className="px-5 py-4"><span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${isAdmin ? "border-gray-300 bg-gray-200 text-gray-600" : "border-blue-200 bg-blue-50 text-blue-700"}`}>{formatStatusLabel(user.role)}</span></td>
                    <td className="px-5 py-4"><span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusBadgeClass(user.status)}`}>{formatStatusLabel(user.status)}</span></td>
                    <td className="px-5 py-4">{formatLastLogin(user.lastLoginAt)}</td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <button type="button" disabled={isAdmin || isSuspended || busy} onClick={() => setEditTarget(user)} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-blue-200 px-3 py-2 font-medium text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400"><PencilSquareIcon className="h-4 w-4" /> Edit</button>
                        <button type="button" disabled={isAdmin || busy} onClick={() => changeStatus(user, isSuspended ? "approved" : "suspended")} className="min-h-10 rounded-lg border border-gray-300 px-3 py-2 font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-400">{isSuspended ? "Reactivate" : "Suspend"}</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!loading && visibleManagedUsers.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-500">No users found.</td></tr>}
            </tbody>
          </table>
        </div>
        <Pagination page={usersPage} totalPages={usersTotalPages} onChange={setUsersPage} />
      </section>

      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4"><div><h3 className="text-lg font-semibold text-gray-900">Edit User Role</h3><p className="mt-1 text-sm text-gray-600">{editTarget.username}</p></div><button type="button" onClick={() => setEditTarget(null)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" aria-label="Close"><XMarkIcon className="h-5 w-5" /></button></div>
            <label className="mt-5 block text-sm font-medium text-gray-700">Role
              <select value={selectedAccessFor(editTarget).role} onChange={(event) => setSelectedAccess(editTarget, { role: event.target.value, canAccessPatientIdentity: event.target.value === "surveillance_team" && selectedAccessFor(editTarget).canAccessPatientIdentity })} className="mt-2 min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5"><option value="cesu">Data Manager</option><option value="surveillance_team">Surveillance Officer</option></select>
            </label>
            <label className="mt-4 flex min-h-11 items-center gap-3 rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-700"><input type="checkbox" disabled={selectedAccessFor(editTarget).role !== "surveillance_team"} checked={selectedAccessFor(editTarget).role === "surveillance_team" && selectedAccessFor(editTarget).canAccessPatientIdentity} onChange={(event) => setSelectedAccess(editTarget, { canAccessPatientIdentity: event.target.checked })} className="h-4 w-4 rounded border-gray-300 text-blue-600" />Allow access to patient-identifiable information</label>
            <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setEditTarget(null)} className="min-h-11 rounded-lg border border-gray-300 px-4 py-2.5 text-gray-700 hover:bg-gray-50">Cancel</button><button type="button" onClick={saveAccess} disabled={actionLoadingId === editTarget._id} className="min-h-11 rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-50">Save Changes</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
