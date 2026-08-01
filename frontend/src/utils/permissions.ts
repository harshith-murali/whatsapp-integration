import type { AdminRole } from "../context/AuthContext.js";

export type Permission =
  | "dashboard.view"
  | "subscribers.view"
  | "subscribers.create"
  | "subscribers.update"
  | "subscribers.delete"
  | "broadcasts.view"
  | "broadcasts.create"
  | "broadcasts.update"
  | "broadcasts.approve"
  | "broadcasts.send"
  | "broadcasts.cancel"
  | "messages.view"
  | "messages.retry"
  | "admins.view"
  | "admins.create"
  | "admins.update"
  | "admins.delete"
  | "settings.manage";

const ROLE_PERMISSIONS: Record<AdminRole, Permission[]> = {
  SUPER_ADMIN: [
    "dashboard.view",
    "subscribers.view",
    "subscribers.create",
    "subscribers.update",
    "subscribers.delete",
    "broadcasts.view",
    "broadcasts.create",
    "broadcasts.update",
    "broadcasts.approve",
    "broadcasts.send",
    "broadcasts.cancel",
    "messages.view",
    "messages.retry",
    "admins.view",
    "admins.create",
    "admins.update",
    "admins.delete",
    "settings.manage",
  ],
  ADMIN: [
    "dashboard.view",
    "subscribers.view",
    "subscribers.create",
    "subscribers.update",
    "subscribers.delete",
    "broadcasts.view",
    "broadcasts.create",
    "broadcasts.update",
    "broadcasts.approve",
    "broadcasts.send",
    "broadcasts.cancel",
    "messages.view",
    "messages.retry",
  ],
  OPERATOR: [
    "dashboard.view",
    "subscribers.view",
    "subscribers.create",
    "subscribers.update",
    "broadcasts.view",
    "broadcasts.create",
    "broadcasts.update",
    "messages.view",
  ],
  VIEWER: [
    "dashboard.view",
    "subscribers.view",
    "broadcasts.view",
    "messages.view",
  ],
};

export const hasPermission = (role: AdminRole | undefined, permission: Permission): boolean => {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
};

const ROUTE_PERMISSIONS: Record<string, Permission> = {
  "/": "dashboard.view",
  "/subscribers": "subscribers.view",
  "/admins": "admins.view",
  "/broadcasts": "broadcasts.view",
  "/messages": "messages.view",
  "/settings": "settings.manage",
};

export const canAccessRoute = (role: AdminRole | undefined, path: string): boolean => {
  if (!role) return false;
  // Standardize potential trailing slashes
  const cleanPath = path === "/" ? "/" : path.replace(/\/$/, "");
  const permission = ROUTE_PERMISSIONS[cleanPath];
  if (!permission) return true; // If not explicitly defined, let standard Auth handling take care of it or allow it
  return hasPermission(role, permission);
};
