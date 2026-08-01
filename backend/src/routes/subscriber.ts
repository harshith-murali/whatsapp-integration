import { Router } from "express";
import {
  getSubscribers,
  getSubscriberById,
  createSubscriber,
  updateSubscriber,
  deleteSubscriber,
} from "../controllers/subscriber.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { AdminRole } from "../generated/prisma/client.js";

export const router = Router();

// Apply auth to all routes
router.use(authenticate);

router.get(
  "/",
  authorize(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.OPERATOR, AdminRole.VIEWER),
  getSubscribers
);

router.get(
  "/:id",
  authorize(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.OPERATOR, AdminRole.VIEWER),
  getSubscriberById
);

router.post(
  "/",
  authorize(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.OPERATOR),
  createSubscriber
);

router.patch(
  "/:id",
  authorize(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.OPERATOR),
  updateSubscriber
);

router.delete(
  "/:id",
  authorize(AdminRole.SUPER_ADMIN, AdminRole.ADMIN),
  deleteSubscriber
);
