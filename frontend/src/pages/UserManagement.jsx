import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "./../context/AuthContext";

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
      setDeleting(false);      // hide spinner
      setDeleteUserId(null);   // close modal
    }
  };

  if (loading) return <p>Loading users...</p>;
  if (error) return <p className="text-red-500">{error}</p>;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">User Management</h2>

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
              Are you sure you want to delete this user? This action cannot be undone.
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
