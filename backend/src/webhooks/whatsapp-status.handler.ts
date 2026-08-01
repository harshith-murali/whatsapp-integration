import { MessageStatus, MessageStatusEventSource, Prisma } from "../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";
import { logger } from "../config/logger.js";

const statusMap: Record<string, MessageStatus> = {
  sent: MessageStatus.SENT,
  delivered: MessageStatus.DELIVERED,
  read: MessageStatus.READ,
  failed: MessageStatus.FAILED,
};

const precedence: Partial<Record<MessageStatus, number>> = {
  [MessageStatus.SUBMITTED]: 1,
  [MessageStatus.SENT]: 2,
  [MessageStatus.DELIVERED]: 3,
  [MessageStatus.READ]: 4,
};

const providerDate = (timestamp: unknown): Date | null => {
  const seconds = Number(timestamp);
  return Number.isFinite(seconds) ? new Date(seconds * 1000) : null;
};

const canApplyStatus = (current: MessageStatus, next: MessageStatus, currentTs: Date | null, nextTs: Date | null): boolean => {
  if (next === MessageStatus.FAILED) return !currentTs || !nextTs || nextTs >= currentTs;
  if (current === MessageStatus.FAILED || current === MessageStatus.CANCELLED) return false;
  return (precedence[next] || 0) >= (precedence[current] || 0);
};

export const handleWhatsAppStatus = async (status: any, webhookEventId: number) => {
  const nextStatus = statusMap[String(status.status || "").toLowerCase()];
  if (!nextStatus || !status.id) return;

  const providerTimestamp = providerDate(status.timestamp);
  const eventKey = ["status", status.id, status.status, status.timestamp, status.errors?.[0]?.code].filter(Boolean).join(":");
  const message = await prisma.message.findUnique({ where: { providerMessageId: status.id } });

  if (!message) {
    logger.warn("[Webhook] Status webhook message not found", {
      webhookEventId,
      providerMessageId: status.id,
      status: status.status,
    });
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.messageStatusEvent.upsert({
      where: { eventKey },
      update: {},
      create: {
        messageId: message.id,
        status: nextStatus,
        newStatus: nextStatus,
        previousStatus: message.status,
        source: MessageStatusEventSource.WEBHOOK,
        eventKey,
        providerTimestamp,
        eventTimestamp: new Date(),
        webhookPayload: status as Prisma.InputJsonValue,
        errorCode: status.errors?.[0]?.code ? String(status.errors[0].code) : null,
        metadata: {
          webhookEventId,
          recipientId: status.recipient_id,
          conversation: status.conversation,
          pricing: status.pricing,
        } as Prisma.InputJsonValue,
      },
    });

    if (!canApplyStatus(message.status, nextStatus, message.latestProviderTimestamp, providerTimestamp)) {
      logger.info("[Webhook] Prevented status downgrade or stale status", {
        messageId: message.id,
        currentStatus: message.status,
        nextStatus,
        webhookEventId,
      });
      return;
    }

    const firstError = status.errors?.[0];
    await tx.message.update({
      where: { id: message.id },
      data: {
        status: nextStatus,
        sentAt: nextStatus === MessageStatus.SENT ? providerTimestamp || new Date() : message.sentAt,
        deliveredAt: nextStatus === MessageStatus.DELIVERED ? providerTimestamp || new Date() : message.deliveredAt,
        readAt: nextStatus === MessageStatus.READ ? providerTimestamp || new Date() : message.readAt,
        failedAt: nextStatus === MessageStatus.FAILED ? providerTimestamp || new Date() : message.failedAt,
        providerErrorCode: firstError?.code ? String(firstError.code) : message.providerErrorCode,
        providerErrorTitle: firstError?.title ? String(firstError.title) : message.providerErrorTitle,
        providerErrorDetails: firstError?.message ? String(firstError.message).slice(0, 500) : message.providerErrorDetails,
        lastWebhookAt: new Date(),
        latestProviderTimestamp: providerTimestamp || message.latestProviderTimestamp,
      },
    });
  });
};
