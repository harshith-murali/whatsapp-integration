import { Router } from "express";
import { login, logout, me } from "../controllers/auth.js";
import { authenticate } from "../middleware/auth.js";
import { loginRateLimiter } from "../middleware/rateLimiter.js";

export const router = Router();

router.post("/login", loginRateLimiter(), login);
router.post("/logout", logout);
router.get("/me", authenticate, me);
