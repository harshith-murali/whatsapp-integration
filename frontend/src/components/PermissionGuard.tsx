import React from "react";
import { useAuth } from "../context/AuthContext.js";
import { hasPermission } from "../utils/permissions.js";
import type { Permission } from "../utils/permissions.js";

interface PermissionGuardProps {
  permission: Permission;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  permission,
  children,
  fallback = null,
}) => {
  const { admin } = useAuth();

  if (!admin || !hasPermission(admin.role, permission)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};
