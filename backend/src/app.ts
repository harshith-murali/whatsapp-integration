import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { router as apiRouter } from "./routes/index.js";
import { requestIdMiddleware } from "./middleware/requestId.js";
import { logger } from "./config/logger.js";
import { getAppConfig } from "./config/env.js";
import { csrfProtection } from "./middleware/csrf.js";
import { createRateLimiter } from "./middleware/rateLimiter.js";
import { router as metricsRouter } from "./routes/metrics.js";

export const app = express();
const appConfig = getAppConfig();

const isAllowedDevOrigin = (origin: string): boolean => {
  if (appConfig.nodeEnv === "production") return false;

  try {
    const parsed = new URL(origin);
    return ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
  } catch {
    return false;
  }
};

if (appConfig.trustProxy) {
  app.set("trust proxy", 1);
}

// Generate request correlation ID early
app.use(requestIdMiddleware);

app.use(
  helmet({
    contentSecurityPolicy: appConfig.nodeEnv === "production" ? undefined : false,
    referrerPolicy: { policy: "no-referrer" },
    frameguard: { action: "deny" },
    hsts: appConfig.nodeEnv === "production" ? { maxAge: 15552000, includeSubDomains: true } : false,
  })
);
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin && appConfig.nodeEnv !== "production") return callback(null, true);
      if (
        origin &&
        (appConfig.corsAllowedOrigins.includes(origin) || isAllowedDevOrigin(origin))
      ) {
        return callback(null, true);
      }
      logger.warn(`[CORS] Blocked request from origin: ${origin || "unknown"}`);
      callback(null, false);
    },
    credentials: true,
  })
);
app.use(
  createRateLimiter({
    name: "global",
    windowMs: appConfig.rateLimitWindowMs,
    maxRequests: appConfig.rateLimitMaxRequests,
  })
);

// Stream Morgan logs directly to Winston logger
const isProd = process.env.NODE_ENV === "production";
const morganFormat = isProd
  ? ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" - :response-time ms'
  : ":method :url :status :res[content-length] - :response-time ms";

app.use(
  morgan(morganFormat, {
    // Skip health check logs to reduce noise
    skip: (req) => req.originalUrl === "/api/health" || req.path === "/api/health",
    stream: {
      write: (message) => {
        logger.http(message.trim());
      },
    },
  })
);

app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as express.Request).rawBody = Buffer.from(buf);
    },
  })
);
app.use(cookieParser());
app.use(csrfProtection);

// Base health endpoint
app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "WhatsApp Alert API is running",
  });
});

app.get("/api/health/live", (_req, res) => {
  res.status(200).json({ success: true, status: "live" });
});

app.use("/metrics", metricsRouter);

// Register API Routes
app.use("/api", apiRouter);

// Unknown route handler (404)
app.use(notFoundHandler);

// Centralized error handler
app.use(errorHandler);
