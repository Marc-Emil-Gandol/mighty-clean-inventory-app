import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

export function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) {
    return (
      <div className="access-denied">
        <h2>Access restricted</h2>
        <p>Your role ({user.role.replace("_", " ")}) doesn't have access to this page.</p>
      </div>
    );
  }
  return children;
}
