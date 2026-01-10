import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function PrivateRoute({ children, allowedRoles }) {
  const { auth, loading } = useAuth();
  // console.log("PrivateRoute auth:", auth, "loading:", loading);


  if (loading) {
    return <div>Loading...</div>;
  }

  if (!auth || !auth.accessToken) {
    return <Navigate to="/login" replace/>;
  }

  if (allowedRoles && !allowedRoles.includes(auth.role)) {
    return <Navigate to="/login" />;
  }

  return typeof children === "function"
    ? children(auth) : children;
}
