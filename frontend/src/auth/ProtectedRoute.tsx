import { Navigate, Outlet } from "react-router-dom";
import { CircularProgress, Box } from "@mui/material";
import { useAuth } from "./AuthContext";
import type { Role } from "../types";

export function ProtectedRoute({ allowedRoles }: { allowedRoles?: Role[] }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/" replace />;

  return <Outlet />;
}
