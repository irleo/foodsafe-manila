import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import PrivateRoute from "./PrivateRoute";
import PublicRoute from "./PublicRoute";
import DashboardLayout from "../layouts/DashboardLayout";
import Spinner from "../components/common/Spinner";

const Login = lazy(() => import("../modules/authentication/LoginPage"));
const RequestAccess = lazy(() => import("../modules/authentication/RequestAccessPage"));
const ForgotPassword = lazy(() => import("../modules/authentication/ForgotPasswordPage"));
const ResetPassword = lazy(() => import("../modules/authentication/ResetPasswordPage"));
const Welcome = lazy(() => import("../modules/authentication/WelcomePage"));

const Dashboard = lazy(() => import("../modules/dashboard/DashboardPage"));
const Analytics = lazy(() => import("../modules/analytics/AnalyticsPage"));
const Heatmap = lazy(() => import("../modules/heatmap/HeatmapPage"));
const Predictions = lazy(() => import("../modules/predictions/PredictionsPage"));
const DataUpload = lazy(() => import("../modules/data-upload/DataUploadPage"));
const UserManagement = lazy(() => import("../modules/user-management/UserManagementPage"));
const ReportLogs = lazy(() => import("../modules/report-logs/ReportLogsPage"));
const Settings = lazy(() => import("../modules/settings/SettingsPage"));

const protectedRoutes = [
  { path: "dashboard", element: <Dashboard />, key: "dashboard" },
  { path: "analytics", element: <Analytics />, key: "analytics" },
  { path: "heatmap", element: <Heatmap />, key: "heatmap" },
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
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route path="/" element={<Welcome />} />
        <Route path="/welcome" element={<Navigate to="/" replace />} />

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

            <Route element={<PrivateRoute allowedRoles={["admin", "cesu"]} />}>
              <Route path="datasets" element={<DataUpload />} />
              <Route path="predictions" element={<Predictions />} />
            </Route>

            <Route element={<PrivateRoute allowedRoles={["admin", "cesu", "surveillance_team"]} />}>
              <Route path="reports" element={<ReportLogs />} />
            </Route>

            <Route element={<PrivateRoute allowedRoles={["admin", "cesu"]} />}>
              <Route path="settings" element={<Settings />} />
            </Route>

            <Route path="thresholds" element={<Navigate to="/dashboard" replace />} />

            <Route element={<PrivateRoute allowedRoles={["admin"]} />}>
              {adminRoutes.map(({ key, ...route }) => (
                <Route key={key} {...route} />
              ))}
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default AppRoutes;
