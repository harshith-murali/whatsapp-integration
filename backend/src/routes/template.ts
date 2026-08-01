import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { AdminRole } from "../generated/prisma/client.js";
import { idempotencyMiddleware } from "../middleware/idempotency.js";
import { getTemplateById, getTemplates, syncTemplates } from "../controllers/template.js";

export const router = Router();

router.use(authenticate);

router.post("/sync", authorize(AdminRole.SUPER_ADMIN, AdminRole.ADMIN), idempotencyMiddleware, syncTemplates);
router.get("/", authorize(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.OPERATOR), getTemplates);
router.get("/:id", authorize(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.OPERATOR), getTemplateById);
