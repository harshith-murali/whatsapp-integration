import { Router } from "express";
import { login, logout, me } from "../controllers/auth.js";
import { authenticate } from "../middleware/auth.js";
import { loginRateLimiter } from "../middleware/rateLimiter.js";
import { issueCsrfToken } from "../middleware/csrf.js";
import { getAppConfig } from "../config/env.js";

export const router = Router();

const config = getAppConfig();

router.get("/csrf", issueCsrfToken);
router.post("/login", loginRateLimiter(config.rateLimitWindowMs, config.loginRateLimitMax), login);
router.post("/logout", logout);
router.get("/me", authenticate, me);
