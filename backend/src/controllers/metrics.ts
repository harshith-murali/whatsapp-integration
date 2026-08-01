import { Request, Response, NextFunction } from "express";
import { prisma } from "../config/prisma.js";

export const metrics = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [messages, broadcasts, webhookFailures, inboxUnread] = await Promise.all([
      prisma.message.groupBy({ by: ["status"], _count: { id: true } }),
      prisma.broadcast.groupBy({ by: ["status"], _count: { id: true } }),
      prisma.webhookEvent.count({ where: { processingStatus: "FAILED" } }),
      prisma.incomingMessage.count({ where: { status: "UNREAD" } }),
    ]);

    const lines = [
      "# HELP whatsapp_messages_total Messages by status",
      "# TYPE whatsapp_messages_total gauge",
      ...messages.map((row) => `whatsapp_messages_total{status="${row.status}"} ${row._count.id}`),
      "# HELP whatsapp_broadcasts_total Broadcasts by status",
      "# TYPE whatsapp_broadcasts_total gauge",
      ...broadcasts.map((row) => `whatsapp_broadcasts_total{status="${row.status}"} ${row._count.id}`),
      "# HELP whatsapp_webhook_failures_total Failed webhook events",
      "# TYPE whatsapp_webhook_failures_total gauge",
      `whatsapp_webhook_failures_total ${webhookFailures}`,
      "# HELP whatsapp_inbox_unread_total Unread inbox messages",
      "# TYPE whatsapp_inbox_unread_total gauge",
      `whatsapp_inbox_unread_total ${inboxUnread}`,
    ];

    res.type("text/plain").send(`${lines.join("\n")}\n`);
  } catch (error) {
    next(error);
  }
};
