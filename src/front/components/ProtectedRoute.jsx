import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ children }) {
  const token = sessionStorage.getItem("token");
  return token ? children : <Navigate to="/login" replace />;
}
