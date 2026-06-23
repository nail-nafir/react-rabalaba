import { Navigate } from "react-router-dom";

/** Admin entry redirection - defaults to assets page */
export default function AdminPage() {
  return <Navigate to="/admin/assets" replace />;
}
