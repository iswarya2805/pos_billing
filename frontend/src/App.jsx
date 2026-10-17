import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import StaffDashboard from "./pages/StaffDashboard";
import MyBills from "./pages/MyBills";
import Products from "./pages/Products";
import Billing from "./pages/Billing";
import Inventory from "./pages/Inventory";
import Reports from "./pages/Reports";
import Returns from "./pages/Returns";
import Staff from "./pages/Staff";
import Suppliers from "./pages/Suppliers";
import SupplierLedger from "./pages/SupplierLedger";

function HomeRoute() {
  const { token, user, loading } = useAuth();
  if (loading) return <div className="route-loading" role="status">Checking your account…</div>;
  if (!token || !user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === "admin" ? "/admin/dashboard" : "/staff/dashboard"} replace />;
}

const AdminOnly = ({ children }) => <ProtectedRoute roles={["admin"]}>{children}</ProtectedRoute>;
const BillingAccess = ({ children }) => <ProtectedRoute roles={["admin", "staff"]}>{children}</ProtectedRoute>;

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route path="/admin/dashboard" element={<AdminOnly><Dashboard /></AdminOnly>} />
      <Route path="/staff/dashboard" element={<ProtectedRoute roles={["staff"]}><StaffDashboard /></ProtectedRoute>} />

      <Route path="/admin/products" element={<AdminOnly><Products /></AdminOnly>} />
      <Route path="/products" element={<BillingAccess><Products /></BillingAccess>} />

      <Route path="/billing" element={<BillingAccess><Billing /></BillingAccess>} />
      <Route path="/staff/billing" element={<ProtectedRoute roles={["staff"]}><Billing /></ProtectedRoute>} />
      <Route path="/staff/bills" element={<ProtectedRoute roles={["staff"]}><MyBills /></ProtectedRoute>} />

      <Route path="/admin/inventory" element={<AdminOnly><Inventory /></AdminOnly>} />
      <Route path="/inventory" element={<AdminOnly><Inventory /></AdminOnly>} />

      <Route path="/admin/reports" element={<AdminOnly><Reports /></AdminOnly>} />
      <Route path="/reports" element={<AdminOnly><Reports /></AdminOnly>} />

      <Route path="/admin/returns" element={<AdminOnly><Returns /></AdminOnly>} />
      <Route path="/returns" element={<AdminOnly><Returns /></AdminOnly>} />

      <Route path="/admin/staff" element={<AdminOnly><Staff /></AdminOnly>} />
      <Route path="/staff" element={<AdminOnly><Staff /></AdminOnly>} />

      <Route path="/admin/suppliers" element={<AdminOnly><Suppliers /></AdminOnly>} />
      <Route path="/suppliers" element={<AdminOnly><Suppliers /></AdminOnly>} />

      <Route path="/admin/supplier-ledger" element={<AdminOnly><SupplierLedger /></AdminOnly>} />
      <Route path="/supplier-ledger" element={<AdminOnly><SupplierLedger /></AdminOnly>} />

      <Route path="/" element={<HomeRoute />} />
      <Route path="*" element={<HomeRoute />} />
    </Routes>
  );
}

function App() {
  return <AuthProvider><BrowserRouter><AppRoutes /></BrowserRouter></AuthProvider>;
}

export default App;
