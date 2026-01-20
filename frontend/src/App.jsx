import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import "leaflet/dist/leaflet.css";
import { Toaster } from "sonner";

import Login from "./pages/Login";
import RequestAccess from "./pages/RequestAccess";
import PrivateRoute from "./components/PrivateRoute";
import PublicRoute from "./components/PublicRoute";
import DashboardLayout from "./layouts/DashboardLayout";

import UserManagement from "./pages/UserManagement";
import Analytics from "./pages/Analytics";
import DatasetUpload from "./pages/DatasetUpload";
import Predictions from "./pages/Predictions";
import Heatmap from "./pages/Heatmap";
import Dashboard from "./pages/Dashboard";



function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster richColors position="top-right" />
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
              element={<Dashboard />}
            />

            <Route path="analytics" element={<Analytics />} />
            <Route path="heatmap" element={<Heatmap />} />
            <Route path="predictions" element={<Predictions />} />
            <Route path="datasets" element={<DatasetUpload />} />

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
            path="/request-access"
            element={
              <PublicRoute>
                <RequestAccess />
              </PublicRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
