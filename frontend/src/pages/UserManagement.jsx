import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";

export default function UserManagement() {
  const { auth } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    setLoading(true);
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`/api/admin/users?page=${page}&limit=5`, {
          headers: {
            Authorization: `Bearer ${auth.accessToken}`,
          },
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

  if (loading) return <p>Loading users...</p>;
  if (error) return <p className="text-red-500">{error}</p>;

  const handleDelete = async (id) => {
  try {
    await axios.delete(`/api/users/${id}`, {
      headers: { Authorization: `Bearer ${auth.accessToken}` },
      withCredentials: true,
    });

    setUsers(prev => prev.filter(user => user._id !== id));
  } catch {
    setError("Failed to delete user.");
  }
};


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
                    onClick={() => handleDelete(user._id)}
                    className="ml-4 bg-red-600 text-white p-1 rounded hover:bg-red-700"
                  >
                    Delete
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div>
        {Array.from({ length: totalPages }, (_, index) => (
          <button
            className={`px-3 py-1 mt-2 rounded ${
              page === index + 1 ? "bg-blue-600 text-white" : "bg-gray-200"
            }`}
            onClick={() => setPage(index + 1)}
            key={index}
          >
            {index + 1}
          </button>
        ))}
      </div>
    </div>
  );
}
