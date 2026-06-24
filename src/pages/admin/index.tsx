import { Navigate } from "react-router-dom";

/** Admin entry redirection - defaults to system metrics page */
export default function AdminPage() {
  return <Navigate to="/admin/summary" replace />;
}
