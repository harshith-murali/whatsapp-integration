import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { AdminRole } from "../generated/prisma/client.js";
import { idempotencyMiddleware } from "../middleware/idempotency.js";
import {
  assignInboxMessage,
  getInbox,
  getInboxMessage,
  replyToInboxMessage,
  updateInboxStatus,
} from "../controllers/inbox.js";

export const router = Router();

router.use(authenticate);
router.use(authorize(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.OPERATOR));

router.get("/", getInbox);
router.get("/:id", getInboxMessage);
router.patch("/:id/status", updateInboxStatus);
router.patch("/:id/assign", assignInboxMessage);
router.post("/:id/reply", idempotencyMiddleware, replyToInboxMessage);
