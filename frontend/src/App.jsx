import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import "leaflet/dist/leaflet.css";

import Login from "./pages/Login";
import Register from "./pages/Register";
import PrivateRoute from "./components/PrivateRoute";
import PublicRoute from "./components/PublicRoute";
import DashboardLayout from "./layouts/DashboardLayout";

import AdminDashboard from "./pages/AdminDashboard";
import UserDashboard from "./pages/UserDashboard";
import UserManagement from "./pages/UserManagement";
import Analytics from "./pages/Analytics";
import DatasetUpload from "./pages/DatasetUpload";
import Predictions from "./pages/Predictions";
import Heatmap from "./pages/Heatmap";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Protected dashboard shell */}
          <Route
            element={
              <PrivateRoute>
                <DashboardLayout />
              </PrivateRoute>
            }
          >
            <Route
              path="/"
              element={
                <PrivateRoute>
                  {(auth) =>
                    auth.role === "admin" ? (
                      <AdminDashboard />
                    ) : (
                      <UserDashboard />
                    )
                  }
                </PrivateRoute>
              }
            />

            <Route path="analytics" element={<Analytics />} />
            <Route path="heatmap" element={<Heatmap />} />
            <Route path="predictions" element={<Predictions />} />
            <Route path="datasets" element={<DatasetUpload />} />

            {/* Admin-only */}
            <Route
              path="user-management"
              element={
                <PrivateRoute allowedRoles={["admin"]}>
                  <UserManagement />
                </PrivateRoute>
              }
            />
          </Route>

          {/* Public routes */}
          <Route
            path="/login"
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            }
          />
          <Route
            path="/register"
            element={
              <PublicRoute>
                <Register />
              </PublicRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
