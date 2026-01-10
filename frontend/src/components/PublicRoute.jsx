import { useAuth } from "../context/AuthContext";
import { Navigate } from "react-router-dom";

export default function PublicRoute({ children }) {
  const {auth, loading} = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }
  
  if (auth && auth.accessToken) {
    return <Navigate to="/" />;
  }

  return children; // Render the public route if not authenticated
}