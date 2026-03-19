import { Routes, Route, Navigate } from "react-router-dom";

import PrivateRoute from "./PrivateRoute";
import PublicRoute from "./PublicRoute";
import DashboardLayout from "../layouts/DashboardLayout";

import Login from "../pages/LoginPage";
import RequestAccess from "../pages/RequestAccessPage";
import ForgotPassword from "../pages/ForgotPasswordPage";
import ResetPassword from "../pages/ResetPasswordPage";
import Welcome from "../pages/WelcomePage";

import Dashboard from "../pages/DashboardPage";
import Analytics from "../pages/AnalyticsPage";
import Heatmap from "../pages/HeatmapPage";
import Predictions from "../pages/PredictionsPage";
import Data from "../pages/DataPage";
import UserManagement from "../pages/UserManagementPage";

const protectedRoutes = [
  { index: true, element: <Dashboard />, key: "dashboard" },
  { path: "analytics", element: <Analytics />, key: "analytics" },
  { path: "heatmap", element: <Heatmap />, key: "heatmap" },
  { path: "predictions", element: <Predictions />, key: "predictions" },
  { path: "datasets", element: <Data />, key: "datasets" },
];

const adminRoutes = [
  {
    path: "user-management",
    element: <UserManagement />,
    key: "user-management",
  },
];

function AppRoutes() {
  return (
    <Routes>
      <Route path="/welcome" element={<Welcome />} />

      <Route element={<PublicRoute />}>
        <Route path="/login" element={<Login />} />
        <Route path="/request-access" element={<RequestAccess />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
      </Route>

      <Route element={<PrivateRoute />}>
        <Route element={<DashboardLayout />}>
          {protectedRoutes.map(({ key, ...route }) => (
            <Route key={key} {...route} />
          ))}

          <Route element={<PrivateRoute allowedRoles={["admin"]} />}>
            {adminRoutes.map(({ key, ...route }) => (
              <Route key={key} {...route} />
            ))}
          </Route>
        </Route>
      </Route>
      
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default AppRoutes;
