import { Router } from "express";
import { metrics } from "../controllers/metrics.js";

export const router = Router();

router.get("/", metrics);
