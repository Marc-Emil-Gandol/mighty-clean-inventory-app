import { Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { Layout } from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Inventory from "./pages/Inventory";
import Sales from "./pages/Sales";
import Returns from "./pages/Returns";
import Reports from "./pages/Reports";
import Employees from "./pages/Employees";
import Customers from "./pages/Customers";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="inventory" element={<Inventory />} />
        <Route
          path="sales"
          element={
            <ProtectedRoute roles={["admin", "sales_staff"]}>
              <Sales />
            </ProtectedRoute>
          }
        />
        <Route path="returns" element={<Returns />} />
        <Route
          path="employees"
          element={
            <ProtectedRoute roles={["admin"]}>
              <Employees />
            </ProtectedRoute>
          }
        />
        <Route path="customers" element={<Customers />} />
        <Route path="reports" element={<Reports />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
