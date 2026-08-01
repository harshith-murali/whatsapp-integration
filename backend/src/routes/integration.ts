import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { AdminRole } from "../generated/prisma/client.js";
import { getWhatsAppIntegrationStatus } from "../controllers/integration.js";

export const router = Router();

router.use(authenticate);

router.get("/whatsapp/status", authorize(AdminRole.SUPER_ADMIN, AdminRole.ADMIN), getWhatsAppIntegrationStatus);
