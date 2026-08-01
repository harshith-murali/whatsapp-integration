import { Router } from "express";
import { router as authRouter } from "./auth.js";
import { router as adminsRouter } from "./admin.js";
import { router as subscribersRouter } from "./subscriber.js";
import { router as dashboardRouter } from "./dashboard.js";
import { router as groupRouter } from "./group.js";
import { router as broadcastRouter } from "./broadcast.js";
import { router as messageRouter } from "./message.js";
import { router as auditLogRouter } from "./auditLog.js";

export const router = Router();

router.use("/auth", authRouter);
router.use("/admins", adminsRouter);
router.use("/subscribers", subscribersRouter);
router.use("/dashboard", dashboardRouter);
router.use("/groups", groupRouter);
router.use("/broadcasts", broadcastRouter);
router.use("/messages", messageRouter);
router.use("/audit-logs", auditLogRouter);
