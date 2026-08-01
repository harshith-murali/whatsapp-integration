import { Request, Response, NextFunction } from "express";
import { prisma } from "../config/prisma.js";
import { BadRequestError, NotFoundError } from "../utils/errors.js";

const parseId = (value: string | string[] | undefined): number => {
  const raw = Array.isArray(value) ? value[0] : value;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw new BadRequestError("Invalid notification ID");
  }
  return id;
};

export const listMyNotifications = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const adminId = req.admin!.id;
    const [notifications, unreadCount] = await Promise.all([
      prisma.adminNotification.findMany({
        where: { adminId, isRead: false },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.adminNotification.count({ where: { adminId, isRead: false } }),
    ]);

    res.status(200).json({
      success: true,
      data: { notifications, unreadCount },
    });
  } catch (error) {
    next(error);
  }
};

export const markNotificationRead = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = parseId(req.params.id);
    const adminId = req.admin!.id;
    const notification = await prisma.adminNotification.findFirst({
      where: { id, adminId },
    });

    if (!notification) {
      throw new NotFoundError("Notification not found");
    }

    const updated = await prisma.adminNotification.update({
      where: { id },
      data: { isRead: true },
    });

    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

export const markAllNotificationsRead = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const adminId = req.admin!.id;
    await prisma.adminNotification.updateMany({
      where: { adminId, isRead: false },
      data: { isRead: true },
    });

    res.status(200).json({ success: true, message: "Notifications marked read" });
  } catch (error) {
    next(error);
  }
};
