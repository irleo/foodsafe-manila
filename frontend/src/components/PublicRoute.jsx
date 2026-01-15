import { useAuth } from "../context/AuthContext";
import { Navigate } from "react-router-dom";
import Spinner from "./Spinner";

export default function PublicRoute({ children }) {
  const {auth, loading} = useAuth();

  if (loading) {
    return <Spinner delay={200}/>;
  }
  
  if (auth && auth.accessToken) {
    return <Navigate to="/" />;
  }

  return children; // Render the public route if not authenticated
}