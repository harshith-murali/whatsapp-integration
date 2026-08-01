import { Request, Response, NextFunction, ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { AppError } from "../utils/errors.js";

export const errorHandler: ErrorRequestHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const isProduction = process.env.NODE_ENV === "production";

  // 1. Zod Validation Error
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      message: "Validation Error",
      errors: err.issues.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      })),
    });
    return;
  }

  // 2. Custom AppError
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: err.errors,
    });
    return;
  }

  // 3. Prisma Known Request Error
  if (err.code && typeof err.code === "string" && err.code.startsWith("P2")) {
    switch (err.code) {
      case "P2002": {
        // Unique constraint failed
        const fields = err.meta?.target || "record";
        res.status(409).json({
          success: false,
          message: `A record with this ${fields} already exists.`,
        });
        return;
      }
      case "P2025": {
        // Record to update/delete not found
        res.status(404).json({
          success: false,
          message: err.meta?.cause || "Record not found.",
        });
        return;
      }
      default:
        break;
    }
  }

  // Log unknown errors for debugging (not secrets)
  if (!isProduction) {
    console.error("[Unhandled Error]:", err);
  }

  // 4. Default Internal Server Error
  const statusCode = err.status || err.statusCode || 500;
  const message = isProduction ? "Internal Server Error" : err.message || "Internal Server Error";

  res.status(statusCode).json({
    success: false,
    message,
    ...(isProduction ? {} : { stack: err.stack }),
  });
};

export const notFoundHandler = (req: Request, res: Response, next: NextFunction): void => {
  res.status(404).json({
    success: false,
    message: `API Route not found: ${req.method} ${req.originalUrl}`,
  });
};
