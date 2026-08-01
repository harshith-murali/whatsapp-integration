import { Router } from "express";
import {
  listMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../controllers/adminNotification.js";
import { authenticate } from "../middleware/auth.js";

export const router = Router();

router.use(authenticate);

router.get("/", listMyNotifications);
router.patch("/read-all", markAllNotificationsRead);
router.patch("/:id/read", markNotificationRead);
