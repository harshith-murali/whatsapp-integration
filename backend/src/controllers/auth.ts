import { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../config/prisma.js";
import { loginSchema } from "../validators/auth.js";
import { BadRequestError, UnauthorizedError } from "../utils/errors.js";
import { getAppConfig } from "../config/env.js";

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const validated = loginSchema.parse(req.body);

    const admin = await prisma.admin.findUnique({
      where: { email: validated.email },
    });

    if (!admin) {
      throw new UnauthorizedError("Invalid email or password");
    }

    if (!admin.isActive) {
      throw new UnauthorizedError("Your account has been deactivated");
    }

    const passwordMatch = await bcrypt.compare(validated.password, admin.passwordHash);
    if (!passwordMatch) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const appConfig = getAppConfig();

    // Generate JWT
    const token = jwt.sign(
      {
        adminId: admin.id,
        email: admin.email,
        role: admin.role,
      },
      appConfig.jwtSecret,
      { expiresIn: `${appConfig.sessionDurationHours}h` }
    );

    // Set cookie
    res.cookie("access_token", token, {
      httpOnly: true,
      secure: appConfig.cookieSecure,
      sameSite: appConfig.cookieSameSite,
      domain: appConfig.cookieDomain,
      maxAge: appConfig.sessionDurationHours * 60 * 60 * 1000,
    });

    res.status(200).json({
      success: true,
      data: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        isActive: admin.isActive,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    res.clearCookie("access_token", {
      httpOnly: true,
      secure: getAppConfig().cookieSecure,
      sameSite: getAppConfig().cookieSameSite,
      domain: getAppConfig().cookieDomain,
    });

    res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const me = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.admin) {
      throw new UnauthorizedError("Not authenticated");
    }

    const admin = await prisma.admin.findUnique({
      where: { id: req.admin.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    if (!admin) {
      throw new UnauthorizedError("Admin user no longer exists");
    }

    if (!admin.isActive) {
      throw new UnauthorizedError("Admin account is inactive");
    }

    res.status(200).json({
      success: true,
      data: admin,
    });
  } catch (error) {
    next(error);
  }
};
