import { Router } from "express";
import {
  getAdmins,
  getAdminById,
  createAdmin,
  updateAdmin,
  updateAdminStatus,
  deleteAdmin,
} from "../controllers/admin.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { AdminRole } from "../generated/prisma/client.js";

export const router = Router();

// Apply SUPER_ADMIN only guards on all admin management endpoints
router.use(authenticate, authorize(AdminRole.SUPER_ADMIN));

router.get("/", getAdmins);
router.get("/:id", getAdminById);
router.post("/", createAdmin);
router.patch("/:id", updateAdmin);
router.patch("/:id/status", updateAdminStatus);
router.delete("/:id", deleteAdmin);
