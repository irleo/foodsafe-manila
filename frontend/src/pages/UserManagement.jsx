import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "./../context/AuthContext";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";

export default function UserManagement() {
  const { auth } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [deleteUserId, setDeleteUserId] = useState(null);
  const [deleting, setDeleting] = useState(false); // ← spinner state

  useEffect(() => {
    setLoading(true);
    const fetchUsers = async () => {
      try {
        const res = await axios.get(`/api/users?page=${page}&limit=3`, {
          headers: { Authorization: `Bearer ${auth.accessToken}` },
          withCredentials: true,
        });
        setUsers(res.data.users);
        setTotalPages(res.data.totalPages);
      } catch {
        setError("Failed to load users");
      } finally {
        setLoading(false);
      }
    };

    if (auth?.accessToken) fetchUsers();
  }, [auth, page]);

  const handleDelete = async (id) => {
    if (!id) return setDeleteUserId(null); // cancel modal

    try {
      setDeleting(true); // show spinner
      await axios.delete(`/api/users/${id}`, {
        headers: { Authorization: `Bearer ${auth.accessToken}` },
        withCredentials: true,
      });
      setUsers((prev) => prev.filter((user) => user._id !== id));
    } catch {
      setError("Failed to delete user.");
    } finally {
      setDeleting(false); // hide spinner
      setDeleteUserId(null); // close modal
    }
  };

  if (loading) return <p>Loading users...</p>;
  if (error) return <p className="text-red-500">{error}</p>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-4">User Management</h2>
        <p className="text-gray-600 mt-1">
          Review and approve user access requests
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-2">Pending Approval</p>
          <p className="text-3xl text-yellow-600">2</p>
          <p className="text-sm text-gray-600 mt-2">Awaiting review</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-2">Approved Users</p>
          <p className="text-3xl text-yellow-600">1</p>
          <p className="text-sm text-gray-600 mt-2">Active accounts</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-2">Rejected</p>
          <p className="text-3xl text-yellow-600">0</p>
          <p className="text-sm text-gray-600 mt-2">Denied access</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="lucide lucide-search absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
            >
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.3-4.3"></path>
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.3-4.3"></path>
            </svg>
            <input
              type="text"
              placeholder="Search users by name, email, or organization..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            ></input>
          </div>
          <div className="flex gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="lucide lucide-funnel w-5 h-5 text-gray-400 self-center"
            >
              <path d="M10 20a1 1 0 0 0 .553.895l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .517-1.341L21.74 4.67A1 1 0 0 0 21 3H3a1 1 0 0 0-.742 1.67l7.225 7.989A2 2 0 0 1 10 14z"></path>
              <path d="M10 20a1 1 0 0 0 .553.895l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .517-1.341L21.74 4.67A1 1 0 0 0 21 3H3a1 1 0 0 0-.742 1.67l7.225 7.989A2 2 0 0 1 10 14z"></path>
            </svg>
            <select
              name=""
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              id=""
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="font-semibold text-lg">User Access Requests</h2>
          <p className="text-sm text-gray-600 mt-1">Showing 3 of 3 users</p>
        </div>
        <div className="divide-y divide-gray-200">
          <div className="p-6 hover:bg-gray-50 transition-colors">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                    <span className="text-blue-600 text-lg">LG</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-lg">Lizbeth Gerona</h3>
                      <span className="px-3 py-1 rounded-full text-sm capitalize border bg-yellow-100 text-yellow-700 border-yellow-300">
                        pending
                      </span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          className="lucide lucide-mail w-4 h-4"
                        >
                          <rect
                            width="20"
                            height="16"
                            x="2"
                            y="4"
                            rx="2"
                          ></rect>
                          <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path>
                        </svg>
                        <a
                          href="mailto:researcher@doh.gov.ph"
                          class="hover:text-blue-600"
                        >
                          researcher@doh.gov.ph
                        </a>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          className="lucide lucide-building w-4 h-4"
                        >
                          <rect
                            width="16"
                            height="20"
                            x="4"
                            y="2"
                            rx="2"
                            ry="2"
                          ></rect>
                          <path d="M9 22v-4h6v4"></path>
                          <path d="M8 6h.01"></path>
                          <path d="M16 6h.01"></path>
                          <path d="M12 6h.01"></path>
                          <path d="M12 10h.01"></path>
                          <path d="M12 14h.01"></path>
                          <path d="M16 10h.01"></path>
                          <path d="M16 14h.01"></path>
                          <path d="M8 10h.01"></path>
                          <path d="M8 14h.01"></path>
                        </svg>
                        <span>DOH Research Division</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          class="lucide lucide-calendar w-4 h-4"
                        >
                          <path d="M8 2v4"></path>
                          <path d="M16 2v4"></path>
                          <rect
                            width="18"
                            height="18"
                            x="3"
                            y="4"
                            rx="2"
                          ></rect>
                          <path d="M3 10h18"></path>
                        </svg>
                        <span>Requested: 01/09/2026</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        class="lucide lucide-check w-4 h-4"
                      >
                        <path d="M20 6 9 17l-5-5"></path>
                      </svg>
                      Approve
                    </button>
                    <button class="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        class="lucide lucide-x w-4 h-4"
                      >
                        <path d="M18 6 6 18"></path>
                        <path d="m6 6 12 12"></path>
                      </svg>
                      Reject
                    </button>
                  </div>
                </div>
                <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    <strong>Note:</strong> Please verify the user's credentials and organization before approving access. This system contains sensitive health data.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="p-6 hover:bg-gray-50 transition-colors">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                    <span className="text-blue-600 text-lg">AB</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-lg">Aron Bautista</h3>
                      <span className="px-3 py-1 rounded-full text-sm capitalize border bg-yellow-100 text-yellow-700 border-yellow-300">
                        pending
                      </span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          className="lucide lucide-mail w-4 h-4"
                        >
                          <rect
                            width="20"
                            height="16"
                            x="2"
                            y="4"
                            rx="2"
                          ></rect>
                          <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path>
                        </svg>
                        <a
                          href="mailto:researcher@doh.gov.ph"
                          class="hover:text-blue-600"
                        >
                          researcher.student@students.national-u.edu.ph
                        </a>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          className="lucide lucide-building w-4 h-4"
                        >
                          <rect
                            width="16"
                            height="20"
                            x="4"
                            y="2"
                            rx="2"
                            ry="2"
                          ></rect>
                          <path d="M9 22v-4h6v4"></path>
                          <path d="M8 6h.01"></path>
                          <path d="M16 6h.01"></path>
                          <path d="M12 6h.01"></path>
                          <path d="M12 10h.01"></path>
                          <path d="M12 14h.01"></path>
                          <path d="M16 10h.01"></path>
                          <path d="M16 14h.01"></path>
                          <path d="M8 10h.01"></path>
                          <path d="M8 14h.01"></path>
                        </svg>
                        <span>NU Manila - Student Researcher</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          class="lucide lucide-calendar w-4 h-4"
                        >
                          <path d="M8 2v4"></path>
                          <path d="M16 2v4"></path>
                          <rect
                            width="18"
                            height="18"
                            x="3"
                            y="4"
                            rx="2"
                          ></rect>
                          <path d="M3 10h18"></path>
                        </svg>
                        <span>Requested: 01/12/2026</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        class="lucide lucide-check w-4 h-4"
                      >
                        <path d="M20 6 9 17l-5-5"></path>
                      </svg>
                      Approve
                    </button>
                    <button class="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        class="lucide lucide-x w-4 h-4"
                      >
                        <path d="M18 6 6 18"></path>
                        <path d="m6 6 12 12"></path>
                      </svg>
                      Reject
                    </button>
                  </div>
                </div>
                <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    <strong>Note:</strong> Please verify the user's credentials and organization before approving access. This system contains sensitive health data.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="p-6 hover:bg-gray-50 transition-colors">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                    <span className="text-blue-600 text-lg">YA</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-lg">Yen Arellano</h3>
                      <span className="px-3 py-1 rounded-full text-sm capitalize border bg-yellow-100 text-yellow-700 border-yellow-300">
                        approved
                      </span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          className="lucide lucide-mail w-4 h-4"
                        >
                          <rect
                            width="20"
                            height="16"
                            x="2"
                            y="4"
                            rx="2"
                          ></rect>
                          <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path>
                        </svg>
                        <a
                          href="mailto:researcher@doh.gov.ph"
                          class="hover:text-blue-600"
                        >
                          researcher.student@students.national-u.edu.ph
                        </a>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          className="lucide lucide-building w-4 h-4"
                        >
                          <rect
                            width="16"
                            height="20"
                            x="4"
                            y="2"
                            rx="2"
                            ry="2"
                          ></rect>
                          <path d="M9 22v-4h6v4"></path>
                          <path d="M8 6h.01"></path>
                          <path d="M16 6h.01"></path>
                          <path d="M12 6h.01"></path>
                          <path d="M12 10h.01"></path>
                          <path d="M12 14h.01"></path>
                          <path d="M16 10h.01"></path>
                          <path d="M16 14h.01"></path>
                          <path d="M8 10h.01"></path>
                          <path d="M8 14h.01"></path>
                        </svg>
                        <span>NU Manila - Student Researcher</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          class="lucide lucide-calendar w-4 h-4"
                        >
                          <path d="M8 2v4"></path>
                          <path d="M16 2v4"></path>
                          <rect
                            width="18"
                            height="18"
                            x="3"
                            y="4"
                            rx="2"
                          ></rect>
                          <path d="M3 10h18"></path>
                        </svg>
                        <span>Requested: 01/12/2026</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="font-semibold text-lg mb-4">Recent Activity</h2>
        <div className="space-y-4">
          <div className="flex items-start gap-3 pb-4 border-b border-gray-100 last:border-0">
            <div className="w-2 h-2 rounded-full mt-2 bg-green-500"></div>
            <div className="flex-1">
              <p className="text-sm">User Approved</p>
              <p className="text-xs text-gray-600 mt-1">Yentin Arellano - Student Researcher</p>
              <p className="text-xs text-gray-400 mt-1">7 days ago</p>
            </div>
          </div>
          <div className="flex items-start gap-3 pb-4 border-b border-gray-100 last:border-0">
            <div className="w-2 h-2 rounded-full mt-2 bg-yellow-500"></div>
            <div className="flex-1">
              <p className="text-sm">New Request</p>
              <p className="text-xs text-gray-600 mt-1">Lizbeth Gerona - DOH Research</p>
              <p className="text-xs text-gray-400 mt-1">5 days ago</p>
            </div>
          </div>
          <div className="flex items-start gap-3 pb-4 border-b border-gray-100 last:border-0">
            <div className="w-2 h-2 rounded-full mt-2 bg-yellow-500"></div>
            <div className="flex-1">
              <p className="text-sm">New Request</p>
              <p className="text-xs text-gray-600 mt-1">Aron Bautista - Student Researcher</p>
              <p className="text-xs text-gray-400 mt-1">5 days ago</p>
            </div>
          </div>
          <div className="flex items-start gap-3 pb-4 border-b border-gray-100 last:border-0">
            <div className="w-2 h-2 rounded-full mt-2 bg-red-500"></div>
            <div className="flex-1">
              <p className="text-sm">User Rejected</p>
              <p className="text-xs text-gray-600 mt-1">Unknown User - Invalid Org</p>
              <p className="text-xs text-gray-400 mt-1">9 days ago</p>
            </div>
          </div>
        </div>
      </div>

      <table className="w-full bg-white rounded shadow">
        <thead>
          <tr className="text-left border-b">
            <th className="p-3">Username</th>
            <th className="p-3">Email</th>
            <th className="p-3">Role</th>
            <th className="p-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user._id} className="border-b">
              <td className="p-3">{user.username}</td>
              <td className="p-3">{user.email}</td>
              <td className="p-3">{user.role}</td>
              <td className="p-3">
                {user.role !== "admin" && (
                  <button
                    onClick={() => setDeleteUserId(user._id)}
                    className="bg-red-600 text-white text-sm p-1.5 rounded hover:bg-red-700"
                  >
                    Delete
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex flex-row p-3 justify-center space-x-2">
        {Array.from({ length: totalPages }, (_, index) => (
          <button
            className={`px-3 py-1 rounded-sm ${
              page === index + 1 ? "bg-blue-600 text-white" : "bg-gray-200"
            }`}
            onClick={() => setPage(index + 1)}
            key={index}
          >
            {index + 1}
          </button>
        ))}
      </div>

      {/* Confirmation Modal */}
      {deleteUserId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow-lg max-w-sm w-full">
            <h3 className="text-lg font-bold mb-5">Confirm Delete</h3>
            <p className="mb-5">
              Are you sure you want to delete this user? This action cannot be
              undone.
            </p>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setDeleteUserId(null)}
                className="px-4 py-2 rounded bg-gray-300 hover:bg-gray-400"
                disabled={deleting} // prevent cancel while deleting
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteUserId)}
                className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700 flex items-center gap-2"
                disabled={deleting} // prevent double clicks
              >
                {deleting && (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
