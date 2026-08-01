import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { AdminRole } from "../generated/prisma/client.js";
import { getWorkerHeartbeats } from "../controllers/worker.js";

export const router = Router();

router.use(authenticate);

router.get(
  "/",
  authorize(AdminRole.SUPER_ADMIN, AdminRole.ADMIN),
  getWorkerHeartbeats
);

export default router;
