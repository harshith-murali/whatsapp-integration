import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../config/prisma.js";
import { UnauthorizedError, ForbiddenError } from "../utils/errors.js";
import { AdminRole } from "../generated/prisma/client.js";

interface JwtPayload {
  adminId: number;
  email: string;
  role: AdminRole;
}

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.cookies?.access_token;
    if (!token) {
      throw new UnauthorizedError("Authentication token is missing");
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error("JWT_SECRET is not configured");
    }

    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(token, jwtSecret) as JwtPayload;
    } catch (err) {
      throw new UnauthorizedError("Invalid or expired authentication token");
    }

    // Verify admin exists and is active
    const admin = await prisma.admin.findUnique({
      where: { id: decoded.adminId },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    if (!admin) {
      throw new UnauthorizedError("Admin user no longer exists");
    }

    if (!admin.isActive) {
      throw new UnauthorizedError("Admin user account is inactive");
    }

    // Attach to request
    req.admin = {
      id: admin.id,
      email: admin.email,
      role: admin.role,
    };

    next();
  } catch (error) {
    next(error);
  }
};

export const authorize = (...allowedRoles: AdminRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (!req.admin) {
        throw new UnauthorizedError("Authentication required");
      }

      if (!allowedRoles.includes(req.admin.role)) {
        throw new ForbiddenError("You do not have permission to perform this action");
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
