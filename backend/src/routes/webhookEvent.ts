import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { AdminRole } from "../generated/prisma/client.js";
import { idempotencyMiddleware } from "../middleware/idempotency.js";
import { replayWebhookEvent } from "../controllers/webhookEvent.js";

export const router = Router();

router.use(authenticate);
router.post("/:id/replay", authorize(AdminRole.SUPER_ADMIN, AdminRole.ADMIN), idempotencyMiddleware, replayWebhookEvent);
