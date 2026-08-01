import { Request, Response, NextFunction } from "express";
import { prisma } from "../config/prisma.js";
import { BadRequestError, NotFoundError } from "../utils/errors.js";

export const getDeadLetterMessages = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 20));
    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where: { status: "FAILED", requiresManualReview: true },
        include: {
          broadcast: { select: { id: true, title: true } },
          subscriber: { select: { id: true, name: true, phoneNumber: true } },
        },
        orderBy: { deadLetteredAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.message.count({ where: { status: "FAILED", requiresManualReview: true } }),
    ]);

    res.json({
      success: true,
      data: { messages, page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

export const requeueDeadLetterMessage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new BadRequestError("Invalid message ID");

    const message = await prisma.message.findUnique({ where: { id } });
    if (!message) throw new NotFoundError("Message not found");
    if (message.status !== "FAILED") throw new BadRequestError("Only FAILED messages can be requeued");

    const updated = await prisma.message.update({
      where: { id },
      data: {
        status: "QUEUED",
        retryCount: 0,
        nextRetryAt: null,
        errorCode: null,
        errorMessage: null,
        failureCategory: null,
        requiresManualReview: false,
        deadLetterResolvedAt: new Date(),
        failedAt: null,
      },
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

export const resolveDeadLetterMessage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new BadRequestError("Invalid message ID");
    const updated = await prisma.message.update({
      where: { id },
      data: {
        requiresManualReview: false,
        deadLetterResolvedAt: new Date(),
      },
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};
