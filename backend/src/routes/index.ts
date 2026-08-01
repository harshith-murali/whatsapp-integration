import { Router } from "express";
import { router as authRouter } from "./auth.js";
import { router as adminsRouter } from "./admin.js";
import { router as subscribersRouter } from "./subscriber.js";
import { router as dashboardRouter } from "./dashboard.js";

export const router = Router();

router.use("/auth", authRouter);
router.use("/admins", adminsRouter);
router.use("/subscribers", subscribersRouter);
router.use("/dashboard", dashboardRouter);
