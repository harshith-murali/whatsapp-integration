import { Request, Response, NextFunction } from "express";
import { prisma } from "../config/prisma.js";
import { UnauthorizedError } from "../utils/errors.js";

/** Masks all but the last 4 digits of a phone number for VIEWER role. */
const maskPhone = (phone: string): string => {
  if (phone.length <= 4) return "••••";
  return phone.slice(0, -4).replace(/./g, "•") + phone.slice(-4);
};

export const getDashboardSummary = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.admin) {
      throw new UnauthorizedError("Not authenticated");
    }

    const isSuperAdmin = req.admin.role === "SUPER_ADMIN";

    // Run counts in parallel using Promise.all for high performance
    const [
      totalAdmins,
      activeAdmins,
      totalSubscribers,
      activeSubscribers,
      unsubscribedSubscribers,
      blockedSubscribers,
      optedInSubscribers,
      recentSubscribers,
    ] = await Promise.all([
      // Only count admins if current user is SUPER_ADMIN
      isSuperAdmin ? prisma.admin.count() : Promise.resolve(null),
      isSuperAdmin ? prisma.admin.count({ where: { isActive: true } }) : Promise.resolve(null),

      // Subscribers metrics
      prisma.subscriber.count(),
      prisma.subscriber.count({ where: { status: "ACTIVE" } }),
      prisma.subscriber.count({ where: { status: "UNSUBSCRIBED" } }),
      prisma.subscriber.count({ where: { status: "BLOCKED" } }),
      prisma.subscriber.count({ where: { optedIn: true } }),

      // 5 most recent subscribers
      prisma.subscriber.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          name: true,
          phoneNumber: true,
          status: true,
          optedIn: true,
          createdAt: true,
        },
      }),
    ]);

    const isViewer = req.admin.role === "VIEWER";

    res.status(200).json({
      success: true,
      data: {
        totalAdmins,
        activeAdmins,
        totalSubscribers,
        activeSubscribers,
        unsubscribedSubscribers,
        blockedSubscribers,
        optedInSubscribers,
        // Mask phone numbers in recent list for VIEWERs
        recentSubscribers: isViewer
          ? recentSubscribers.map((s) => ({ ...s, phoneNumber: maskPhone(s.phoneNumber) }))
          : recentSubscribers,
      },
    });
  } catch (error) {
    next(error);
  }
};
