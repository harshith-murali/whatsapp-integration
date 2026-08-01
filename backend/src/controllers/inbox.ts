import { Request, Response, NextFunction } from "express";
import { prisma } from "../config/prisma.js";
import { BadRequestError, ForbiddenError, NotFoundError } from "../utils/errors.js";
import { getMetaConfig } from "../config/env.js";
import { MessageProviderFactory } from "../providers/provider-factory.js";
import { MetaWhatsAppProvider } from "../providers/meta-whatsapp.provider.js";
import { maskPhone } from "../config/logger.js";

const canHandleInbox = (role?: string) => role === "SUPER_ADMIN" || role === "ADMIN" || role === "OPERATOR";

const windowState = (lastInbound?: Date | null) => {
  const config = getMetaConfig();
  if (!lastInbound) {
    return { windowOpen: false, windowExpiresAt: null, replyMode: "TEMPLATE_REQUIRED" };
  }
  const windowExpiresAt = new Date(lastInbound.getTime() + config.customerServiceWindowHours * 60 * 60 * 1000);
  const windowOpen = windowExpiresAt.getTime() > Date.now();
  return { windowOpen, windowExpiresAt, replyMode: windowOpen ? "FREE_FORM" : "TEMPLATE_REQUIRED" };
};

export const getInbox = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!canHandleInbox(req.admin?.role)) throw new ForbiddenError();
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 20));
    const where: any = {};

    if (req.query.status) where.status = req.query.status;
    if (req.query.messageType) where.messageType = req.query.messageType;
    if (req.query.unreadOnly === "true") where.status = "UNREAD";
    if (req.query.assignedAdminId) where.assignedAdminId = Number(req.query.assignedAdminId);
    if (req.query.phone) where.phoneNumber = { contains: String(req.query.phone).replace(/[^\d]/g, "") };

    const [messages, total] = await Promise.all([
      prisma.incomingMessage.findMany({
        where,
        include: {
          subscriber: { select: { id: true, name: true, lastInboundMessageAt: true } },
          assignedAdmin: { select: { id: true, name: true, email: true } },
        },
        orderBy: { receivedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.incomingMessage.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        messages: messages.map((message) => ({
          ...message,
          phoneNumber: maskPhone(message.phoneNumber),
          rawWebhookEventId: undefined,
          window: windowState(message.subscriber?.lastInboundMessageAt || message.receivedAt),
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

export const getInboxMessage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!canHandleInbox(req.admin?.role)) throw new ForbiddenError();
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new BadRequestError("Invalid inbox message ID");
    const message = await prisma.incomingMessage.findUnique({
      where: { id },
      include: {
        subscriber: { select: { id: true, name: true, lastInboundMessageAt: true } },
        assignedAdmin: { select: { id: true, name: true, email: true } },
      },
    });
    if (!message) throw new NotFoundError("Inbox message not found");
    res.json({
      success: true,
      data: {
        ...message,
        phoneNumber: maskPhone(message.phoneNumber),
        rawWebhookEventId: undefined,
        window: windowState(message.subscriber?.lastInboundMessageAt || message.receivedAt),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateInboxStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!canHandleInbox(req.admin?.role)) throw new ForbiddenError();
    const id = Number(req.params.id);
    const status = String(req.body.status || "");
    if (!["UNREAD", "OPEN", "RESOLVED", "IGNORED"].includes(status)) throw new BadRequestError("Invalid inbox status");
    const message = await prisma.incomingMessage.update({ where: { id }, data: { status: status as any } });
    res.json({ success: true, data: message });
  } catch (error) {
    next(error);
  }
};

export const assignInboxMessage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.admin?.role !== "SUPER_ADMIN" && req.admin?.role !== "ADMIN") throw new ForbiddenError();
    const id = Number(req.params.id);
    const assignedAdminId = req.body.assignedAdminId ? Number(req.body.assignedAdminId) : null;
    const message = await prisma.incomingMessage.update({ where: { id }, data: { assignedAdminId } });
    res.json({ success: true, data: message });
  } catch (error) {
    next(error);
  }
};

export const replyToInboxMessage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!canHandleInbox(req.admin?.role)) throw new ForbiddenError();
    const id = Number(req.params.id);
    const text = String(req.body.text || "").trim();
    if (!text || text.length > 4096) throw new BadRequestError("Reply text must be 1-4096 characters");

    const incoming = await prisma.incomingMessage.findUnique({
      where: { id },
      include: { subscriber: true },
    });
    if (!incoming) throw new NotFoundError("Inbox message not found");

    const state = windowState(incoming.subscriber?.lastInboundMessageAt || incoming.receivedAt);
    if (!state.windowOpen) {
      throw new BadRequestError("Customer-service window is closed. Use an approved template reply.");
    }

    const provider = MessageProviderFactory.getProvider();
    if (!(provider instanceof MetaWhatsAppProvider)) {
      res.json({ success: true, data: { providerMode: "mock", message: "Mock mode reply accepted without external send." } });
      return;
    }

    const result = await provider.sendTextMessage({ to: incoming.phoneNumber, text });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};
