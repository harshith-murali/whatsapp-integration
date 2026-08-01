import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { AdminRole } from "../generated/prisma/client.js";
import {
  getGroups,
  getGroupById,
  getGroupMembers,
  createGroup,
  updateGroup,
  deleteGroup,
  addGroupMember,
  removeGroupMember,
  bulkAddGroupMembers,
} from "../controllers/group.js";

export const router = Router();

// Apply auth middleware to all group routes
router.use(authenticate);

// View groups and members
router.get("/", authorize(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.OPERATOR), getGroups);
router.get("/:id", authorize(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.OPERATOR), getGroupById);
router.get("/:id/members", authorize(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.OPERATOR), getGroupMembers);

// Create, edit and delete groups (Super Admin & Admin only)
router.post("/", authorize(AdminRole.SUPER_ADMIN, AdminRole.ADMIN), createGroup);
router.patch("/:id", authorize(AdminRole.SUPER_ADMIN, AdminRole.ADMIN), updateGroup);
router.delete("/:id", authorize(AdminRole.SUPER_ADMIN, AdminRole.ADMIN), deleteGroup);

// Manage memberships (Super Admin, Admin & Operator can manage group members)
router.post("/:id/subscribers", authorize(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.OPERATOR), addGroupMember);
router.delete("/:id/subscribers/:subscriberId", authorize(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.OPERATOR), removeGroupMember);
router.post("/:id/subscribers/bulk", authorize(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.OPERATOR), bulkAddGroupMembers);
