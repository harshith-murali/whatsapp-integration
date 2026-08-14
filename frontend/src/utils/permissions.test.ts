import { describe, it, expect } from "vitest";
import { hasPermission, canAccessRoute } from "./permissions";

describe("hasPermission", () => {
  it("denies everything when no role is present", () => {
    expect(hasPermission(undefined, "dashboard.view")).toBe(false);
    expect(hasPermission(undefined, "broadcasts.approve")).toBe(false);
  });

  it("grants SUPER_ADMIN the administrative permissions", () => {
    expect(hasPermission("SUPER_ADMIN", "admins.delete")).toBe(true);
    expect(hasPermission("SUPER_ADMIN", "settings.manage")).toBe(true);
    expect(hasPermission("SUPER_ADMIN", "broadcasts.approve")).toBe(true);
  });

  it("withholds admin-user management from ADMIN", () => {
    expect(hasPermission("ADMIN", "admins.delete")).toBe(false);
    expect(hasPermission("ADMIN", "settings.manage")).toBe(false);
    // But ADMIN still runs the broadcast workflow.
    expect(hasPermission("ADMIN", "broadcasts.approve")).toBe(true);
    expect(hasPermission("ADMIN", "broadcasts.queue")).toBe(true);
  });

  it("lets OPERATOR draft and submit but never approve or queue", () => {
    // Separation of duties: the author of a broadcast must not be able to
    // approve or send it.
    expect(hasPermission("OPERATOR", "broadcasts.create")).toBe(true);
    expect(hasPermission("OPERATOR", "broadcasts.submit")).toBe(true);
    expect(hasPermission("OPERATOR", "broadcasts.approve")).toBe(false);
    expect(hasPermission("OPERATOR", "broadcasts.queue")).toBe(false);
    expect(hasPermission("OPERATOR", "broadcasts.cancel")).toBe(false);
  });

  it("restricts VIEWER to read-only dashboard and subscribers", () => {
    expect(hasPermission("VIEWER", "dashboard.view")).toBe(true);
    expect(hasPermission("VIEWER", "subscribers.view")).toBe(true);
    expect(hasPermission("VIEWER", "subscribers.create")).toBe(false);
    expect(hasPermission("VIEWER", "broadcasts.create")).toBe(false);
    expect(hasPermission("VIEWER", "broadcasts.view")).toBe(false);
  });

  it("never lets a lower role exceed SUPER_ADMIN", () => {
    const sensitive = [
      "admins.create",
      "admins.delete",
      "settings.manage",
      "accessRequests.approve",
    ] as const;

    for (const permission of sensitive) {
      expect(hasPermission("OPERATOR", permission)).toBe(false);
      expect(hasPermission("VIEWER", permission)).toBe(false);
    }
  });
});

describe("canAccessRoute", () => {
  it("denies all routes without a role", () => {
    expect(canAccessRoute(undefined, "/")).toBe(false);
    expect(canAccessRoute(undefined, "/broadcasts")).toBe(false);
  });

  it("maps top-level routes to their permission", () => {
    expect(canAccessRoute("SUPER_ADMIN", "/settings")).toBe(true);
    expect(canAccessRoute("ADMIN", "/settings")).toBe(false);
    expect(canAccessRoute("OPERATOR", "/admins")).toBe(false);
    expect(canAccessRoute("VIEWER", "/subscribers")).toBe(true);
  });

  it("applies the parent permission to detail routes", () => {
    expect(canAccessRoute("OPERATOR", "/broadcasts/42")).toBe(true);
    expect(canAccessRoute("VIEWER", "/broadcasts/42")).toBe(false);
    expect(canAccessRoute("ADMIN", "/messages/7")).toBe(true);
  });

  it("ignores a trailing slash", () => {
    expect(canAccessRoute("VIEWER", "/subscribers/")).toBe(
      canAccessRoute("VIEWER", "/subscribers")
    );
  });

  it("treats the dashboard root consistently", () => {
    expect(canAccessRoute("VIEWER", "/")).toBe(true);
  });
});
