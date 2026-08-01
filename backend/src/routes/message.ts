import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { AdminRole } from "../generated/prisma/client.js";
import { getMessages, getMessageById, requeueMessage } from "../controllers/message.js";

export const router = Router();

router.use(authenticate);

router.get(
  "/",
  authorize(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.OPERATOR),
  getMessages
);

router.get(
  "/:id",
  authorize(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.OPERATOR),
  getMessageById
);

router.post(
  "/:id/requeue",
  authorize(AdminRole.SUPER_ADMIN, AdminRole.ADMIN),
  requeueMessage
);
