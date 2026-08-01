import type { AdminRole } from "../context/AuthContext.js";

export type Permission =
  | "dashboard.view"
  | "subscribers.view"
  | "subscribers.create"
  | "subscribers.update"
  | "subscribers.delete"
  // Recipient Groups
  | "groups.view"
  | "groups.create"
  | "groups.update"
  | "groups.delete"
  | "groups.members.manage"
  // Broadcast campaigns workflow
  | "broadcasts.view"
  | "broadcasts.create"
  | "broadcasts.update"
  | "broadcasts.delete"
  | "broadcasts.submit"
  | "broadcasts.approve"
  | "broadcasts.reject"
  | "broadcasts.preview"
  | "broadcasts.queue"
  | "broadcasts.cancel"
  // Message logs
  | "messages.view"
  // Admins & Settings
  | "admins.view"
  | "admins.create"
  | "admins.update"
  | "admins.delete"
  | "settings.manage"
  // Audit Logs
  | "auditLogs.view"
  // Dashboard Widget Segment Permissions
  | "dashboard.adminMetrics"
  | "dashboard.broadcastMetrics"
  | "dashboard.operatorMetrics"
  | "dashboard.recentCampaigns"
  | "dashboard.quickActions";

const ROLE_PERMISSIONS: Record<AdminRole, Permission[]> = {
  SUPER_ADMIN: [
    "dashboard.view",
    "subscribers.view",
    "subscribers.create",
    "subscribers.update",
    "subscribers.delete",
    "groups.view",
    "groups.create",
    "groups.update",
    "groups.delete",
    "groups.members.manage",
    "broadcasts.view",
    "broadcasts.create",
    "broadcasts.update",
    "broadcasts.delete",
    "broadcasts.submit",
    "broadcasts.approve",
    "broadcasts.reject",
    "broadcasts.preview",
    "broadcasts.queue",
    "broadcasts.cancel",
    "messages.view",
    "admins.view",
    "admins.create",
    "admins.update",
    "admins.delete",
    "settings.manage",
    "auditLogs.view",
    // Dashboard widgets
    "dashboard.adminMetrics",
    "dashboard.broadcastMetrics",
    "dashboard.recentCampaigns",
    "dashboard.quickActions",
  ],
  ADMIN: [
    "dashboard.view",
    "subscribers.view",
    "subscribers.create",
    "subscribers.update",
    "subscribers.delete",
    "groups.view",
    "groups.create",
    "groups.update",
    "groups.delete",
    "groups.members.manage",
    "broadcasts.view",
    "broadcasts.create",
    "broadcasts.update",
    "broadcasts.delete",
    "broadcasts.submit",
    "broadcasts.approve",
    "broadcasts.reject",
    "broadcasts.preview",
    "broadcasts.queue",
    "broadcasts.cancel",
    "messages.view",
    "auditLogs.view",
    // Dashboard widgets
    "dashboard.broadcastMetrics",
    "dashboard.recentCampaigns",
    "dashboard.quickActions",
  ],
  OPERATOR: [
    "dashboard.view",
    "subscribers.view",
    "subscribers.create",
    "subscribers.update",
    "groups.view",
    "groups.members.manage",
    "broadcasts.view",
    "broadcasts.create",
    "broadcasts.update",
    "broadcasts.delete",
    "broadcasts.submit",
    "messages.view",
    // Dashboard widgets
    "dashboard.operatorMetrics",
    "dashboard.quickActions",
  ],
  VIEWER: [
    "dashboard.view",
    "subscribers.view",
  ],
};

export const hasPermission = (role: AdminRole | undefined, permission: Permission): boolean => {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
};

const ROUTE_PERMISSIONS: Record<string, Permission> = {
  "/": "dashboard.view",
  "/subscribers": "subscribers.view",
  "/groups": "groups.view",
  "/broadcasts": "broadcasts.view",
  "/messages": "messages.view",
  "/admins": "admins.view",
  "/settings": "settings.manage",
};

export const canAccessRoute = (role: AdminRole | undefined, path: string): boolean => {
  if (!role) return false;
  const cleanPath = path === "/" ? "/" : path.replace(/\/$/, "");
  
  if (ROUTE_PERMISSIONS[cleanPath]) {
    return hasPermission(role, ROUTE_PERMISSIONS[cleanPath]);
  }
  
  if (cleanPath.startsWith("/groups/")) return hasPermission(role, "groups.view");
  if (cleanPath.startsWith("/broadcasts/")) return hasPermission(role, "broadcasts.view");
  if (cleanPath.startsWith("/messages/")) return hasPermission(role, "messages.view");

  return true;
};
