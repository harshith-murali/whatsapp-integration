import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { router as apiRouter } from "./routes/index.js";
import { requestIdMiddleware } from "./middleware/requestId.js";
import { logger } from "./config/logger.js";

export const app = express();

// Generate request correlation ID early
app.use(requestIdMiddleware);

app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
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

// Base health endpoint
app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "WhatsApp Alert API is running",
  });
});

// Register API Routes
app.use("/api", apiRouter);

// Unknown route handler (404)
app.use(notFoundHandler);

// Centralized error handler
app.use(errorHandler);
