import { Router } from "express";
import { getDashboardSummary } from "../controllers/dashboard.js";
import { authenticate } from "../middleware/auth.js";

export const router = Router();

router.get("/summary", authenticate, getDashboardSummary);
