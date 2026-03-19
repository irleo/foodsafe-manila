import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Spinner from "../components/Spinner";

export default function PublicRoute() {
  const { auth, loading } = useAuth();

  if (loading) {
    return <Spinner delay={200} />;
  }

  if (auth && auth.accessToken) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}