import { Request, Response, NextFunction } from "express";
import { prisma } from "../config/prisma.js";
import { BadRequestError, NotFoundError } from "../utils/errors.js";

const isViewer = (role: string | undefined) => role === "VIEWER";

const maskPhone = (phone: string): string => {
  if (phone.length <= 4) return "••••";
  return phone.slice(0, -4).replace(/./g, "•") + phone.slice(-4);
};

export const getMessages = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 10));
    
    const broadcastId = req.query.broadcastId ? parseInt(req.query.broadcastId as string) : undefined;
    const subscriberId = req.query.subscriberId ? parseInt(req.query.subscriberId as string) : undefined;
    const status = req.query.status as string | undefined;
    const search = (req.query.search as string)?.trim() || "";
    
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    
    const sortBy = (req.query.sortBy as string) || "createdAt";
    const sortOrder = (req.query.sortOrder as "asc" | "desc") || "desc";

    const where: any = {};

    if (broadcastId) {
      where.broadcastId = broadcastId;
    }
    if (subscriberId) {
      where.subscriberId = subscriberId;
    }
    if (status) {
      where.status = status;
    }

    // Date range filter
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    // Search by subscriber name or phone
    if (search) {
      where.subscriber = {
        OR: [
          { name: { contains: search } },
          { phoneNumber: { contains: search } },
        ],
      };
    }

    // Bounded allowed sorting fields
    const allowedSort = ["createdAt", "updatedAt", "status", "phoneNumber"];
    const orderByField = allowedSort.includes(sortBy) ? sortBy : "createdAt";

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where,
        include: {
          broadcast: { select: { id: true, title: true } },
          subscriber: { select: { id: true, name: true, phoneNumber: true } },
        },
        orderBy: { [orderByField]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.message.count({ where }),
    ]);

    const userRole = req.admin?.role;
    const mask = isViewer(userRole);

    res.status(200).json({
      success: true,
      data: {
        messages: messages.map((m) => ({
          id: m.id,
          broadcastId: m.broadcastId,
          broadcastTitle: m.broadcast.title,
          subscriberId: m.subscriberId,
          subscriberName: m.subscriber.name,
          phoneNumber: mask ? maskPhone(m.phoneNumber) : m.phoneNumber,
          status: m.status,
          errorCode: m.errorCode,
          errorMessage: m.errorMessage,
          retryCount: m.retryCount,
          sentAt: m.sentAt,
          deliveredAt: m.deliveredAt,
          readAt: m.readAt,
          createdAt: m.createdAt,
          updatedAt: m.updatedAt,
        })),
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getMessageById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      throw new BadRequestError("Invalid message ID");
    }

    const message = await prisma.message.findUnique({
      where: { id },
      include: {
        broadcast: { select: { id: true, title: true, message: true } },
        subscriber: { select: { id: true, name: true, phoneNumber: true } },
      },
    });

    if (!message) {
      throw new NotFoundError("Message log not found");
    }

    const mask = isViewer(req.admin?.role);

    res.status(200).json({
      success: true,
      data: {
        id: message.id,
        broadcastId: message.broadcastId,
        broadcastTitle: message.broadcast.title,
        broadcastMessage: message.broadcast.message,
        subscriberId: message.subscriberId,
        subscriberName: message.subscriber.name,
        phoneNumber: mask ? maskPhone(message.phoneNumber) : message.phoneNumber,
        status: message.status,
        errorCode: message.errorCode,
        errorMessage: message.errorMessage,
        retryCount: message.retryCount,
        sentAt: message.sentAt,
        deliveredAt: message.deliveredAt,
        readAt: message.readAt,
        createdAt: message.createdAt,
        updatedAt: message.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getBroadcastMessages = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      throw new BadRequestError("Invalid broadcast ID");
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 10));
    const status = req.query.status as string | undefined;
    const search = (req.query.search as string)?.trim() || "";

    const where: any = { broadcastId: id };
    if (status) {
      where.status = status;
    }
    if (search) {
      where.subscriber = {
        OR: [
          { name: { contains: search } },
          { phoneNumber: { contains: search } },
        ],
      };
    }

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where,
        include: {
          subscriber: { select: { id: true, name: true, phoneNumber: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.message.count({ where }),
    ]);

    const mask = isViewer(req.admin?.role);

    res.status(200).json({
      success: true,
      data: {
        messages: messages.map((m) => ({
          id: m.id,
          subscriberId: m.subscriberId,
          subscriberName: m.subscriber.name,
          phoneNumber: mask ? maskPhone(m.subscriber.phoneNumber) : m.subscriber.phoneNumber,
          status: m.status,
          createdAt: m.createdAt,
          updatedAt: m.updatedAt,
        })),
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};
