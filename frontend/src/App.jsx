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
          {/* Routes with Navbar */}
          <Route element={<DashboardLayout />}>
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

            {/* Routes for Sidebar*/}
            <Route path="analytics" element={<Analytics />} />
            <Route path="heatmap" element={<Heatmap />} />
            <Route path="predictions" element={<Predictions />} />
            
            {/* ADMIN ONLY */}
            <Route
              path="user-management"
              element={
                <PrivateRoute allowedRoles={["admin"]}>
                  <UserManagement />
                </PrivateRoute>
              }
            />
            <Route
              path="datasets"
              element={
                <PrivateRoute allowedRoles={["admin"]}>
                  <DatasetUpload />
                </PrivateRoute>
              }
            />
          </Route>

          {/* Routes without Navbar */}
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

          <Route
            path="*"
            element={
              <h1 className="text-center mt-5 text-3xl font-bold">
                Page Not Found
              </h1>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
