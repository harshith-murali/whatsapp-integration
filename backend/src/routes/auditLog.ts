import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { AdminRole } from "../generated/prisma/client.js";
import { getAuditLogs } from "../controllers/auditLog.js";

export const router = Router();

router.use(authenticate);

router.get(
  "/",
  authorize(AdminRole.SUPER_ADMIN, AdminRole.ADMIN),
  getAuditLogs
);
