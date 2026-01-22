import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useAuth } from "./../context/AuthContext";
import {
  MagnifyingGlassIcon,
  CheckIcon,
  XMarkIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";

const LIMIT = 5;

export default function UserManagement() {
  const { auth } = useAuth();

  // main list (based on statusFilter)
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0 });

  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [error, setError] = useState(null);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [statusFilter, setStatusFilter] = useState("pending");
  const [search, setSearch] = useState("");

  // Approved list (separate, deletable)
  const [approvedUsers, setApprovedUsers] = useState([]);
  const [approvedLoading, setApprovedLoading] = useState(false);
  const [approvedPage, setApprovedPage] = useState(1);
  const [approvedTotalPages, setApprovedTotalPages] = useState(1);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const headers = useMemo(
    () => ({
      Authorization: `Bearer ${auth?.accessToken}`,
    }),
    [auth?.accessToken],
  );

  const fetchStats = async () => {
    const res = await axios.get("/api/users/stats", {
      headers,
      withCredentials: true,
    });
    setStats(res.data);
  };

  const buildParams = ({ pageNum, status }) => {
    const params = new URLSearchParams();
    params.set("page", String(pageNum));
    params.set("limit", String(LIMIT));
    params.set("status", status);
    return params;
  };

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = buildParams({ pageNum: page, status: statusFilter });

      const res = await axios.get(`/api/users?${params.toString()}`, {
        headers,
        withCredentials: true,
      });

      setUsers(res.data.users);
      setTotalPages(res.data.totalPages);

      await fetchStats();
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const fetchApprovedUsers = async () => {
    setApprovedLoading(true);
    setError(null);

    try {
      const params = buildParams({ pageNum: approvedPage, status: "approved" });

      const res = await axios.get(`/api/users?${params.toString()}`, {
        headers,
        withCredentials: true,
      });

      setApprovedUsers(res.data.users);
      setApprovedTotalPages(res.data.totalPages);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load approved users");
    } finally {
      setApprovedLoading(false);
    }
  };

  // Load main list
  useEffect(() => {
    if (!auth?.accessToken) return;
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth?.accessToken, page, statusFilter]);

  // Load approved list (separate pagination)
  useEffect(() => {
    if (!auth?.accessToken) return;
    fetchApprovedUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth?.accessToken, approvedPage]);

  // Debounced search for BOTH lists
  useEffect(() => {
    if (!auth?.accessToken) return;
    const t = setTimeout(() => {
      setPage(1);
      setApprovedPage(1);
      fetchUsers();
      fetchApprovedUsers();
    }, 350);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const updateStatus = async (userId, status) => {
    try {
      setActionLoadingId(userId);

      await axios.patch(
        `/api/users/${userId}/status`,
        { status },
        { headers, withCredentials: true },
      );

      // update main list UI
      setUsers((prev) =>
        prev.map((u) => (u._id === userId ? { ...u, status } : u)),
      );

      // if viewing "pending", remove it after action
      if (statusFilter === "pending") {
        setUsers((prev) => prev.filter((u) => u._id !== userId));
      }

      // if approved newly, refresh approved list
      if (status === "approved") {
        await fetchApprovedUsers();
      }

      await fetchStats();
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to update user status");
    } finally {
      setActionLoadingId(null);
    }
  };

  const openDeleteModal = (user) => setDeleteTarget(user);

  const closeDeleteModal = () => {
    if (deleting) return;
    setDeleteTarget(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget?._id) return;

    try {
      setDeleting(true);

      await axios.delete(`/api/users/${deleteTarget._id}`, {
        headers,
        withCredentials: true,
      });

      // Remove from approved list UI
      setApprovedUsers((prev) =>
        prev.filter((u) => u._id !== deleteTarget._id),
      );

      await fetchStats();

      // If we deleted last approved item on this page, go back a page
      if (approvedUsers.length === 1 && approvedPage > 1) {
        setApprovedPage((p) => p - 1);
      } else {
        await fetchApprovedUsers();
      }

      setDeleteTarget(null);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to delete user");
    } finally {
      setDeleting(false);
    }
  };

  const badgeClass = (status) => {
    if (status === "approved")
      return "bg-green-100 text-green-700 border-green-300";
    if (status === "rejected") return "bg-red-100 text-red-700 border-red-300";
    return "bg-yellow-100 text-yellow-700 border-yellow-300";
  };

  const initials = (name = "") =>
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("");

  if (loading) return <p>Loading users...</p>;
  if (error) return <p className="text-red-500">{error}</p>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">User Management</h2>
        <p className="text-gray-600 mt-1">
          User access and role management
        </p>
      </div>

      {/* Stats cards */}
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

      {/* Search + Filter */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search users by name, email, or organization..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={statusFilter}
            onChange={(e) => {
              setPage(1);
              setStatusFilter(e.target.value);
            }}
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* Approval List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="font-semibold text-lg">User Access Requests</h2>
          <p className="text-sm text-gray-600 mt-1">
            Showing {users.length} users (page {page} of {totalPages})
          </p>
        </div>

        <div className="divide-y divide-gray-200">
          {users.map((u) => (
            <div key={u._id} className="p-6 hover:bg-gray-50 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 flex-1">
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                    <span className="text-blue-600 text-lg">
                      {initials(u.username)}
                    </span>
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-lg">{u.username}</h3>
                      <span
                        className={`px-3 py-1 rounded-full text-sm capitalize border ${badgeClass(
                          u.status,
                        )}`}
                      >
                        {u.status}
                      </span>

                      {u.role === "admin" && (
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

                {/* Actions (approve/reject only) */}
                <div className="flex flex-col gap-2 items-end">
                  {u.status === "pending" && (
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
                </div>
              </div>
            </div>
          ))}

          {users.length === 0 && (
            <div className="p-6 text-sm text-gray-600">
              No users found for this filter.
            </div>
          )}
        </div>
      </div>

      {/* Pagination (main list) */}
      <div className="flex justify-center gap-2">
        <button
          className="px-3 py-1 rounded bg-gray-200 disabled:opacity-50"
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
        >
          Prev
        </button>
        <span className="px-3 py-1 text-sm text-gray-700">
          Page {page} / {totalPages}
        </span>
        <button
          className="px-3 py-1 rounded bg-gray-200 disabled:opacity-50"
          disabled={page >= totalPages}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </button>
      </div>

      {/* Approved Users (Deletable list) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="font-semibold text-lg">Approved Users (Deletable)</h2>
          <p className="text-sm text-gray-600 mt-1">
            Showing {approvedUsers.length} users (page {approvedPage} of{" "}
            {approvedTotalPages})
          </p>
        </div>

        <div className="divide-y divide-gray-200">
          {approvedLoading ? (
            <div className="p-6 text-sm text-gray-600">
              Loading approved users...
            </div>
          ) : (
            <>
              {approvedUsers.map((u) => (
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
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="font-semibold">{u.username}</h3>
                          {u.role === "admin" && (
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
                      </div>
                    </div>

                    <button
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                      onClick={() => openDeleteModal(u)}
                      disabled={u.role === "admin"}
                      title={
                        u.role === "admin"
                          ? "Admin users cannot be deleted"
                          : "Delete user"
                      }
                    >
                      <TrashIcon className="w-4 h-4" />
                      Delete
                    </button>
                  </div>
                </div>
              ))}

              {approvedUsers.length === 0 && (
                <div className="p-6 text-sm text-gray-600">
                  No approved users found.
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Pagination (approved list) */}
      <div className="flex justify-center gap-2">
        <button
          className="px-3 py-1 rounded bg-gray-200 disabled:opacity-50"
          disabled={approvedPage <= 1}
          onClick={() => setApprovedPage((p) => p - 1)}
        >
          Prev
        </button>
        <span className="px-3 py-1 text-sm text-gray-700">
          Page {approvedPage} / {approvedTotalPages}
        </span>
        <button
          className="px-3 py-1 rounded bg-gray-200 disabled:opacity-50"
          disabled={approvedPage >= approvedTotalPages}
          onClick={() => setApprovedPage((p) => p + 1)}
        >
          Next
        </button>
      </div>

      {/* Delete confirmation modal */}
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
