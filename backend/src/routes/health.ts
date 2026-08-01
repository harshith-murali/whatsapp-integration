import { Router } from "express";
import { readiness, healthDetails } from "../controllers/health.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { AdminRole } from "../generated/prisma/client.js";

export const router = Router();

router.get("/ready", readiness);
router.get(
  "/details",
  authenticate,
  authorize(AdminRole.SUPER_ADMIN),
  healthDetails
);
