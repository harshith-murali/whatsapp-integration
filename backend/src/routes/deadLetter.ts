import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { AdminRole } from "../generated/prisma/client.js";
import {
  getDeadLetterMessages,
  requeueDeadLetterMessage,
  resolveDeadLetterMessage,
} from "../controllers/deadLetter.js";
import { idempotencyMiddleware } from "../middleware/idempotency.js";

export const router = Router();

router.use(authenticate, authorize(AdminRole.SUPER_ADMIN, AdminRole.ADMIN));
router.get("/messages", getDeadLetterMessages);
router.post("/messages/:id/requeue", idempotencyMiddleware, requeueDeadLetterMessage);
router.post("/messages/:id/resolve", idempotencyMiddleware, resolveDeadLetterMessage);
