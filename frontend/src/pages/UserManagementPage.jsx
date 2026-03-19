import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import useAxiosPrivate from "../hooks/useAxiosPrivate";
import {
  MagnifyingGlassIcon,
  CheckIcon,
  XMarkIcon,
  TrashIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import { FilterIcon } from "lucide-react";

const LIMIT = 3;

export default function UserManagement() {
  const { auth } = useAuth();
  const axiosPrivate = useAxiosPrivate();

  const [users, setUsers] = useState([]);
  const [approvedUsers, setApprovedUsers] = useState([]);
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0 });

  const [loading, setLoading] = useState(true);
  const [approvedLoading, setApprovedLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [error, setError] = useState(null);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [approvedPage, setApprovedPage] = useState(1);
  const [approvedTotalPages, setApprovedTotalPages] = useState(1);

  const [statusFilter, setStatusFilter] = useState("pending");
  const [search, setSearch] = useState("");

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const buildParams = useCallback(({ pageNum, status }) => {
    const params = new URLSearchParams();
    params.set("page", String(pageNum));
    params.set("limit", String(LIMIT));
    params.set("status", status);
    return params;
  }, []);

  const fetchStats = useCallback(async () => {
    const res = await axiosPrivate.get("/api/users/stats");
    setStats(res.data);
  }, [axiosPrivate]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);

    try {
      const params = buildParams({
        pageNum: page,
        status: statusFilter,
      });

      const res = await axiosPrivate.get(`/api/users?${params.toString()}`);

      setUsers(res.data.users || []);
      setTotalPages(res.data.totalPages || 1);
      setError(null);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [axiosPrivate, buildParams, page, statusFilter]);

  const fetchApprovedUsers = useCallback(async () => {
    setApprovedLoading(true);

    try {
      const params = buildParams({
        pageNum: approvedPage,
        status: "approved",
      });

      const res = await axiosPrivate.get(`/api/users?${params.toString()}`);

      setApprovedUsers(res.data.users || []);
      setApprovedTotalPages(res.data.totalPages || 1);
      setError(null);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load approved users");
    } finally {
      setApprovedLoading(false);
    }
  }, [axiosPrivate, buildParams, approvedPage]);

  const refreshAll = useCallback(async () => {
    await Promise.all([fetchUsers(), fetchApprovedUsers(), fetchStats()]);
  }, [fetchUsers, fetchApprovedUsers, fetchStats]);

  useEffect(() => {
    if (!auth?.accessToken) return;
    fetchUsers();
  }, [auth?.accessToken, fetchUsers]);

  useEffect(() => {
    if (!auth?.accessToken) return;
    fetchApprovedUsers();
  }, [auth?.accessToken, fetchApprovedUsers]);

  useEffect(() => {
    if (!auth?.accessToken) return;

    const loadStats = async () => {
      try {
        await fetchStats();
      } catch {
        // no-op
      }
    };

    loadStats();
  }, [auth?.accessToken, fetchStats]);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return users;

    return users.filter((u) => {
      const haystack = [
        u.username,
        u.email,
        u.organization,
        u.position,
        u.reason,
        u.status,
        u.role,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [users, search]);

  const filteredApprovedUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return approvedUsers;

    return approvedUsers.filter((u) => {
      const haystack = [u.username, u.email, u.organization, u.position, u.role]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [approvedUsers, search]);

  const isAdminUser = (user) => user?.role === "admin";
  const isPendingUser = (user) => user?.status === "pending";
  const isRejectedUser = (user) => user?.status === "rejected";
  const isApprovedUser = (user) => user?.status === "approved";

  const showPendingActions = (user) => isPendingUser(user);
  const showRejectedActions = (user) => isRejectedUser(user);

  const canDeleteUser = (user) => user?.role !== "admin";

  const getDeleteTitle = (user) =>
    isAdminUser(user) ? "Admin users cannot be deleted" : "Delete user";

  const badgeClass = (status) => {
    if (status === "approved") {
      return "bg-green-100 text-green-700 border-green-300";
    }
    if (status === "rejected") {
      return "bg-red-100 text-red-700 border-red-300";
    }
    return "bg-yellow-100 text-yellow-700 border-yellow-300";
  };

  const initials = (name = "") =>
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("");

  const updateStatus = async (userId, nextStatus) => {
    try {
      setActionLoadingId(userId);

      await axiosPrivate.patch(`/api/users/${userId}/status`, {
        status: nextStatus,
      });

      setUsers((prev) => {
        const updated = prev.map((u) =>
          u._id === userId ? { ...u, status: nextStatus } : u,
        );

        if (statusFilter !== nextStatus) {
          return updated.filter((u) => u._id !== userId);
        }

        return updated;
      });

      if (nextStatus === "approved") {
        await fetchApprovedUsers();
      }

      await Promise.all([fetchUsers(), fetchStats()]);
      setError(null);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to update user status");
    } finally {
      setActionLoadingId(null);
    }
  };

  const openDeleteModal = (user) => {
    if (!canDeleteUser(user)) return;
    setDeleteTarget(user);
  };

  const closeDeleteModal = () => {
    if (deleting) return;
    setDeleteTarget(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget?._id) return;

    try {
      setDeleting(true);

      await axiosPrivate.delete(`/api/users/${deleteTarget._id}`);

      const deletingApprovedUser = isApprovedUser(deleteTarget);
      const deletingRejectedUser = isRejectedUser(deleteTarget);

      const shouldGoBackApprovedPage =
        deletingApprovedUser && approvedUsers.length === 1 && approvedPage > 1;

      const shouldGoBackMainPage =
        deletingRejectedUser && users.length === 1 && page > 1;

      if (deletingApprovedUser) {
        setApprovedUsers((prev) =>
          prev.filter((u) => u._id !== deleteTarget._id),
        );
      }

      if (deletingRejectedUser) {
        setUsers((prev) => prev.filter((u) => u._id !== deleteTarget._id));
      }

      setDeleteTarget(null);

      await fetchStats();

      if (shouldGoBackApprovedPage) {
        setApprovedPage((prev) => prev - 1);
      } else if (shouldGoBackMainPage) {
        setPage((prev) => prev - 1);
      } else {
        await Promise.all([fetchApprovedUsers(), fetchUsers()]);
      }

      setError(null);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to delete user");
    } finally {
      setDeleting(false);
    }
  };

  const retryLoad = async () => {
    setError(null);
    await refreshAll();
  };

  if (loading && approvedLoading) {
    return <p>Loading users...</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">User Management</h2>
        <p className="text-gray-600 mt-1">User access and role management</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-red-700 text-sm">{error}</p>
          <button
            onClick={retryLoad}
            className="mt-3 px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-2">Pending Approval</p>
          <p className="text-3xl text-yellow-600">{stats.pending}</p>
          <p className="text-sm text-gray-600 mt-2">Awaiting review</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-2">Approved Users</p>
          <p className="text-3xl text-green-600">{stats.approved}</p>
          <p className="text-sm text-gray-600 mt-2">Active accounts</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-2">Rejected</p>
          <p className="text-3xl text-red-600">{stats.rejected}</p>
          <p className="text-sm text-gray-600 mt-2">Denied access</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Filter visible users by name, email, or organization..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Pending/Rejected Filters */}
          <div className="flex items-center gap-3">
            <FilterIcon className="h-4 w-4 text-gray-500" />

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setStatusFilter("pending");
                  setPage(1);
                  setSearch("");
                }}
                className={`px-4 py-2 rounded-lg border text-sm font-medium border-b-2 transition
      ${
        statusFilter === "pending"
          ? "bg-yellow-100 border-yellow-300 text-yellow-700"
          : "border-transparent text-gray-600 hover:bg-gray-100"
      }`}
              >
                Pending ({stats.pending})
              </button>

              <button
                onClick={() => {
                  setStatusFilter("rejected");
                  setPage(1);
                  setSearch("");
                }}
                className={`px-4 py-2 rounded-lg border text-sm font-medium border-b-2 transition
      ${
        statusFilter === "rejected"
          ? "bg-red-100 border-red-300 text-red-700"
          : "border-transparent text-gray-600 hover:bg-gray-100"
      }`}
              >
                Rejected ({stats.rejected})
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="font-semibold text-lg">User access queue</h2>
          <p className="text-sm text-gray-600 mt-1">
            Showing {filteredUsers.length} visible users (page {page} of{" "}
            {totalPages})
          </p>
        </div>

        <div className="divide-y divide-gray-200">
          {loading ? (
            <div className="p-6 text-sm text-gray-600">Loading users...</div>
          ) : (
            <>
              {filteredUsers.map((u) => (
                <div
                  key={u._id}
                  className="p-6 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                        <span className="text-blue-600 text-lg">
                          {initials(u.username)}
                        </span>
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <h3 className="font-semibold text-lg">
                            {u.username}
                          </h3>

                          <span
                            className={`px-3 py-1 rounded-full text-sm capitalize border ${badgeClass(
                              u.status,
                            )}`}
                          >
                            {u.status}
                          </span>

                          {isAdminUser(u) && (
                            <span className="px-3 py-1 rounded-full text-xs border bg-indigo-50 text-indigo-700 border-indigo-200">
                              admin
                            </span>
                          )}
                        </div>

                        <div className="space-y-1 text-sm text-gray-600">
                          <div>
                            <span className="font-medium">Email:</span>{" "}
                            <a
                              href={`mailto:${u.email}`}
                              className="hover:text-blue-600"
                            >
                              {u.email}
                            </a>
                          </div>

                          {u.organization && (
                            <div>
                              <span className="font-medium">Organization:</span>{" "}
                              {u.organization}
                            </div>
                          )}

                          {u.position && (
                            <div>
                              <span className="font-medium">Position:</span>{" "}
                              {u.position}
                            </div>
                          )}

                          {u.reason && (
                            <div className="mt-2 bg-gray-50 border border-gray-200 rounded-lg p-3">
                              <p className="text-gray-700">
                                <span className="font-medium">Reason:</span>{" "}
                                {u.reason}
                              </p>
                            </div>
                          )}

                          <div className="text-xs text-gray-400 mt-2">
                            Requested:{" "}
                            {u.createdAt
                              ? new Date(u.createdAt).toLocaleDateString()
                              : "-"}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 items-end">
                      {showPendingActions(u) && (
                        <div className="flex gap-2">
                          <button
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                            disabled={actionLoadingId === u._id}
                            onClick={() => updateStatus(u._id, "approved")}
                          >
                            <CheckIcon className="w-4 h-4" />
                            {actionLoadingId === u._id ? "..." : "Approve"}
                          </button>

                          <button
                            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                            disabled={actionLoadingId === u._id}
                            onClick={() => updateStatus(u._id, "rejected")}
                          >
                            <XMarkIcon className="w-4 h-4" />
                            {actionLoadingId === u._id ? "..." : "Reject"}
                          </button>
                        </div>
                      )}

                      {showRejectedActions(u) && (
                        <div className="flex gap-2">
                          <button
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                            disabled={actionLoadingId === u._id}
                            onClick={() => updateStatus(u._id, "pending")}
                          >
                            <ArrowPathIcon className="w-4 h-4" />
                            {actionLoadingId === u._id ? "..." : "Restore"}
                          </button>

                          <button
                            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                            disabled={
                              !canDeleteUser(u) || actionLoadingId === u._id
                            }
                            onClick={() => openDeleteModal(u)}
                            title={getDeleteTitle(u)}
                          >
                            <TrashIcon className="w-4 h-4" />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {filteredUsers.length === 0 && (
                <div className="p-6 text-sm text-gray-600">
                  {search.trim()
                    ? "No visible users match your search."
                    : "No users found for this filter."}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="flex justify-center gap-2">
        <button
          className="px-3 py-1 rounded bg-gray-200 disabled:opacity-50"
          disabled={page <= 1}
          onClick={() => setPage((prev) => prev - 1)}
        >
          Prev
        </button>

        <span className="px-3 py-1 text-sm text-gray-700">
          Page {page} / {totalPages}
        </span>

        <button
          className="px-3 py-1 rounded bg-gray-200 disabled:opacity-50"
          disabled={page >= totalPages}
          onClick={() => setPage((prev) => prev + 1)}
        >
          Next
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="font-semibold text-lg">Approved users</h2>
          <p className="text-sm text-gray-600 mt-1">
            Showing {filteredApprovedUsers.length} visible users (page{" "}
            {approvedPage} of {approvedTotalPages})
          </p>
        </div>

        <div className="divide-y divide-gray-200">
          {approvedLoading ? (
            <div className="p-6 text-sm text-gray-600">
              Loading approved users...
            </div>
          ) : (
            <>
              {filteredApprovedUsers.map((u) => (
                <div
                  key={u._id}
                  className="p-6 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                        <span className="text-green-700 text-sm">
                          {initials(u.username)}
                        </span>
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1 flex-wrap">
                          <h3 className="font-semibold">{u.username}</h3>

                          {isAdminUser(u) && (
                            <span className="px-3 py-1 rounded-full text-xs border bg-indigo-50 text-indigo-700 border-indigo-200">
                              admin
                            </span>
                          )}
                        </div>

                        <div className="text-sm text-gray-600">
                          <span className="font-medium">Email:</span>{" "}
                          <a
                            href={`mailto:${u.email}`}
                            className="hover:text-blue-600"
                          >
                            {u.email}
                          </a>
                        </div>

                        {u.organization && (
                          <div className="text-sm text-gray-600 mt-1">
                            <span className="font-medium">Organization:</span>{" "}
                            {u.organization}
                          </div>
                        )}

                        {u.position && (
                          <div className="text-sm text-gray-600 mt-1">
                            <span className="font-medium">Position:</span>{" "}
                            {u.position}
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                      onClick={() => openDeleteModal(u)}
                      disabled={!canDeleteUser(u)}
                      title={getDeleteTitle(u)}
                    >
                      <TrashIcon className="w-4 h-4" />
                      Delete
                    </button>
                  </div>
                </div>
              ))}

              {filteredApprovedUsers.length === 0 && (
                <div className="p-6 text-sm text-gray-600">
                  {search.trim()
                    ? "No approved users match your search."
                    : "No approved users found."}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="flex justify-center gap-2">
        <button
          className="px-3 py-1 rounded bg-gray-200 disabled:opacity-50"
          disabled={approvedPage <= 1}
          onClick={() => setApprovedPage((prev) => prev - 1)}
        >
          Prev
        </button>

        <span className="px-3 py-1 text-sm text-gray-700">
          Page {approvedPage} / {approvedTotalPages}
        </span>

        <button
          className="px-3 py-1 rounded bg-gray-200 disabled:opacity-50"
          disabled={approvedPage >= approvedTotalPages}
          onClick={() => setApprovedPage((prev) => prev + 1)}
        >
          Next
        </button>
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-sm w-full">
            <h3 className="text-lg font-bold mb-5">Confirm Delete</h3>
            <p className="mb-5">
              Are you sure you want to delete{" "}
              <span className="font-semibold">{deleteTarget.username}</span>?
              This action cannot be undone.
            </p>

            <div className="flex justify-end gap-2">
              <button
                onClick={closeDeleteModal}
                disabled={deleting}
                className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
              >
                {deleting && (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
