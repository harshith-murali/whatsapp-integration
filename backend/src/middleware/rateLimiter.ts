import { Request, Response, NextFunction } from "express";

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const store: RateLimitStore = {};

export const createRateLimiter = (args: {
  name: string;
  windowMs: number;
  maxRequests: number;
  keyPrefix?: string;
  keyGenerator?: (req: Request) => string;
}) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const key = `${args.keyPrefix || args.name}:${args.keyGenerator ? args.keyGenerator(req) : ip}`;
    const now = Date.now();

    if (!store[key]) {
      store[key] = {
        count: 1,
        resetTime: now + args.windowMs,
      };
      next();
      return;
    }

    const client = store[key]!;

    if (now > client.resetTime) {
      client.count = 1;
      client.resetTime = now + args.windowMs;
      next();
      return;
    }

    client.count++;

    if (client.count > args.maxRequests) {
      const secondsLeft = Math.ceil((client.resetTime - now) / 1000);
      res.status(429).json({
        success: false,
        message: `Too many requests. Please try again in ${secondsLeft} seconds.`,
      });
      return;
    }

    next();
  };
};

export const loginRateLimiter = (windowMs = 60 * 1000, maxRequests = 5) =>
  createRateLimiter({ name: "login", windowMs, maxRequests });

export const accessRequestIpRateLimiter = () =>
  createRateLimiter({
    name: "access-request-ip",
    windowMs: 60 * 60 * 1000,
    maxRequests: 5,
  });

export const accessRequestEmailRateLimiter = () =>
  createRateLimiter({
    name: "access-request-email",
    windowMs: 24 * 60 * 60 * 1000,
    maxRequests: 3,
    keyGenerator: (req) => {
      const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "missing-email";
      return email;
    },
  });
