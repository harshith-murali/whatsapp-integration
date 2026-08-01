import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { router as apiRouter } from "./routes/index.js";

export const app = express();

// Security and utility middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(express.json());
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