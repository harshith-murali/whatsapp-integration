import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

// Extend Express Request type to include requestId
declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

/**
 * Express middleware to generate or accept an x-request-id.
 * Safe UUID generation protects against unbounded arbitrary values.
 */
export const requestIdMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let requestId = req.headers["x-request-id"];

  // If x-request-id header exists and is a valid alphanumeric/hyphen string of moderate length
  if (typeof requestId === "string" && /^[a-zA-Z0-9-]{8,40}$/.test(requestId)) {
    req.id = requestId;
  } else {
    req.id = crypto.randomUUID();
  }

  // Set the header in response
  res.setHeader("x-request-id", req.id);
  next();
};
