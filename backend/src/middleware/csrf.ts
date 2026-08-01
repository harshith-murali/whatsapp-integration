import crypto from "crypto";
import { Request, Response, NextFunction } from "express";
import { ForbiddenError } from "../utils/errors.js";
import { getAppConfig } from "../config/env.js";

const CSRF_COOKIE = "csrf_token";
const CSRF_HEADER = "x-csrf-token";

export const issueCsrfToken = (_req: Request, res: Response): void => {
  const config = getAppConfig();
  const token = crypto.randomBytes(32).toString("hex");
  res.cookie(CSRF_COOKIE, token, {
    httpOnly: false,
    secure: config.cookieSecure,
    sameSite: config.cookieSameSite,
    domain: config.cookieDomain,
    maxAge: config.sessionDurationHours * 60 * 60 * 1000,
  });
  res.status(200).json({ success: true, data: { csrfToken: token } });
};

const isSafeMethod = (method: string): boolean => ["GET", "HEAD", "OPTIONS"].includes(method);

export const csrfProtection = (req: Request, _res: Response, next: NextFunction): void => {
  if (isSafeMethod(req.method)) return next();
  if (req.originalUrl.startsWith("/api/webhooks/")) return next();
  if (req.originalUrl === "/api/auth/csrf") return next();

  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.header(CSRF_HEADER);

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return next(new ForbiddenError("Invalid or missing CSRF token"));
  }

  next();
};
