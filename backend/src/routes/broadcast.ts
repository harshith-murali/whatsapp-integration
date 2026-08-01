import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { AdminRole } from "../generated/prisma/client.js";
import {
  getBroadcasts,
  getBroadcastById,
  createBroadcast,
  updateBroadcast,
  deleteBroadcast,
  submitBroadcast,
  approveBroadcast,
  rejectBroadcast,
  getRecipientPreview,
  queueBroadcast,
  cancelBroadcast,
  requeueFailedBroadcast,
} from "../controllers/broadcast.js";
import { getBroadcastMessages } from "../controllers/message.js";

export const router = Router();

router.use(authenticate);

// View list and details (All roles except Viewer)
router.get(
  "/",
  authorize(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.OPERATOR),
  getBroadcasts
);

router.get(
  "/:id",
  authorize(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.OPERATOR),
  getBroadcastById
);

// CRUD draft operations (Super Admin, Admin & Operator can create/edit/delete drafts)
router.post(
  "/",
  authorize(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.OPERATOR),
  createBroadcast
);

router.patch(
  "/:id",
  authorize(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.OPERATOR),
  updateBroadcast
);

router.delete(
  "/:id",
  authorize(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.OPERATOR),
  deleteBroadcast
);

// Submit workflow (Super Admin, Admin & Operator)
router.post(
  "/:id/submit",
  authorize(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.OPERATOR),
  submitBroadcast
);

// Approval review workflow (Super Admin & Admin only)
router.post(
  "/:id/approve",
  authorize(AdminRole.SUPER_ADMIN, AdminRole.ADMIN),
  approveBroadcast
);

router.post(
  "/:id/reject",
  authorize(AdminRole.SUPER_ADMIN, AdminRole.ADMIN),
  rejectBroadcast
);

// Recipient preview and queue control
router.get(
  "/:id/recipient-preview",
  authorize(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.OPERATOR),
  getRecipientPreview
);

router.post(
  "/:id/queue",
  authorize(AdminRole.SUPER_ADMIN, AdminRole.ADMIN),
  queueBroadcast
);

router.post(
  "/:id/cancel",
  authorize(AdminRole.SUPER_ADMIN, AdminRole.ADMIN),
  cancelBroadcast
);

router.post(
  "/:id/requeue-failed",
  authorize(AdminRole.SUPER_ADMIN, AdminRole.ADMIN),
  requeueFailedBroadcast
);

// Related messages logs sub-route
router.get(
  "/:id/messages",
  authorize(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.OPERATOR),
  getBroadcastMessages
);
export default router;
