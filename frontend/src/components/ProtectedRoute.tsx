import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";
import { canAccessRoute, hasPermission } from "../utils/permissions.js";
import type { Permission } from "../utils/permissions.js";

interface ProtectedRouteProps {
  children: React.ReactNode;
  permission?: Permission;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, permission }) => {
  const { admin, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-50 dark:bg-slate-900">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Loading system session...</p>
        </div>
      </div>
    );
  }

  if (!admin) {
    // Redirect to login but save the current path
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If a specific permission is requested on this route guard
  if (permission && !hasPermission(admin.role, permission)) {
    return <Navigate to="/unauthorized" replace />;
  }

  // Fallback to checking the route path mapping dynamically
  if (!canAccessRoute(admin.role, location.pathname)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};
