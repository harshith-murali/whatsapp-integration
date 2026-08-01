import { Request, Response, NextFunction } from "express";

interface RateLimitStore {
  [ip: string]: {
    count: number;
    resetTime: number;
  };
}

const store: RateLimitStore = {};

export const loginRateLimiter = (
  windowMs: number = 15 * 60 * 1000, // 15 minutes
  maxRequests: number = 5 // max 5 login requests per window
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();

    if (!store[ip]) {
      store[ip] = {
        count: 1,
        resetTime: now + windowMs,
      };
      next();
      return;
    }

    const client = store[ip]!;

    if (now > client.resetTime) {
      client.count = 1;
      client.resetTime = now + windowMs;
      next();
      return;
    }

    client.count++;

    if (client.count > maxRequests) {
      const secondsLeft = Math.ceil((client.resetTime - now) / 1000);
      res.status(429).json({
        success: false,
        message: `Too many login attempts. Please try again in ${secondsLeft} seconds.`,
      });
      return;
    }

    next();
  };
};
