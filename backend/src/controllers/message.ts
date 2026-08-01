import { Request, Response, NextFunction } from "express";
import { prisma } from "../config/prisma.js";
import { BadRequestError, NotFoundError } from "../utils/errors.js";
import { logger } from "../config/logger.js";

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
    
    const hasError = req.query.hasError === "true";
    const retryable = req.query.retryable === "true";
    const nextRetryBefore = req.query.nextRetryBefore as string | undefined;

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

    if (hasError) {
      where.errorCode = { not: null };
    }

    if (retryable) {
      where.status = { in: ["QUEUED", "FAILED"] };
      where.retryCount = { lt: prisma.message.fields.maxRetries }; // Or dynamically using maxRetries check in code, let's keep it where check simpler or filter below. Let's do simpler check:
      // where.retryCount = { lt: 3 }; is safer for Prisma group locks or we can do raw code filters if needed. Let's filter where nextRetryAt is not null or retryCount < 3.
    }

    if (nextRetryBefore) {
      where.nextRetryAt = { lte: new Date(nextRetryBefore) };
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
          maxRetries: m.maxRetries,
          nextRetryAt: m.nextRetryAt,
          lastAttemptAt: m.lastAttemptAt,
          processingStartedAt: m.processingStartedAt,
          submittedAt: m.submittedAt,
          failedAt: m.failedAt,
          cancelledAt: m.cancelledAt,
          providerName: m.providerName,
          providerMessageId: m.providerMessageId,
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
        maxRetries: message.maxRetries,
        nextRetryAt: message.nextRetryAt,
        lastAttemptAt: message.lastAttemptAt,
        processingStartedAt: message.processingStartedAt,
        submittedAt: message.submittedAt,
        failedAt: message.failedAt,
        cancelledAt: message.cancelledAt,
        providerName: message.providerName,
        providerMessageId: message.providerMessageId,
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
          errorCode: m.errorCode,
          errorMessage: m.errorMessage,
          retryCount: m.retryCount,
          maxRetries: m.maxRetries,
          nextRetryAt: m.nextRetryAt,
          lastAttemptAt: m.lastAttemptAt,
          processingStartedAt: m.processingStartedAt,
          submittedAt: m.submittedAt,
          failedAt: m.failedAt,
          cancelledAt: m.cancelledAt,
          providerName: m.providerName,
          providerMessageId: m.providerMessageId,
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

export const requeueMessage = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      throw new BadRequestError("Invalid message ID");
    }

    const adminId = req.admin?.id;
    if (!adminId) {
      throw new BadRequestError("Authenticated administrator required");
    }

    const message = await prisma.message.findUnique({
      where: { id },
      include: { broadcast: true },
    });

    if (!message) {
      throw new NotFoundError("Message not found");
    }

    if (message.status !== "FAILED") {
      throw new BadRequestError("Only FAILED messages can be manually requeued");
    }

    if (message.broadcast.status === "CANCELLED") {
      throw new BadRequestError("Cannot requeue messages belonging to a CANCELLED broadcast");
    }

    // Update message state back to QUEUED
    const updated = await prisma.$transaction(async (tx) => {
      const msg = await tx.message.update({
        where: { id },
        data: {
          status: "QUEUED",
          retryCount: 0,
          errorCode: null,
          errorMessage: null,
          failedAt: null,
          nextRetryAt: null,
          lastAttemptAt: null,
        },
      });

      await tx.messageStatusEvent.create({
        data: {
          messageId: id,
          status: "QUEUED",
          previousStatus: "FAILED",
          workerId: `admin-${adminId}`,
          metadata: { reason: "Manual admin requeue" },
        },
      });

      return msg;
    });

    // Recalculate parent broadcast status
    // Import dynamically or execute inline
    // Wait, let's recalculate broadcast status by calling a helper or updating status to PROCESSING/QUEUED if it was terminal
    await prisma.broadcast.update({
      where: { id: message.broadcastId },
      data: {
        status: message.broadcast.status === "FAILED" || message.broadcast.status === "PARTIALLY_FAILED" ? "PROCESSING" : message.broadcast.status,
      },
    });

    // Create Audit Log
    await prisma.auditLog.create({
      data: {
        adminId,
        action: "MESSAGE_REQUEUED",
        entityType: "Message",
        entityId: id,
        metadata: { broadcastId: message.broadcastId },
      },
    });

    logger.info(`Message ID ${id} manually requeued by Admin ID: ${adminId}`, {
      messageId: id,
      adminId,
      requestId: req.id as string,
    });

    res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

