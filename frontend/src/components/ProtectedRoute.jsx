import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function ProtectedRoute({ roles, children }) {
  const { token, user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="route-loading" role="status">Checking your account…</div>;
  if (!token || !user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={user.role === "admin" ? "/admin/dashboard" : "/staff/dashboard"} replace />;
  }
  return children;
}

export default ProtectedRoute;
