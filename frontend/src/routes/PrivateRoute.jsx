import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Spinner from "../components/Spinner";

export default function PrivateRoute({ allowedRoles }) {
  const { auth, loading } = useAuth();

  if (loading) {
    return <Spinner delay={200} />;
  }

  if (!auth || !auth.accessToken) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(auth.role)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}