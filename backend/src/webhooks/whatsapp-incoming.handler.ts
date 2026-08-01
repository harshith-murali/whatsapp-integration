import { IncomingMessageStatus, Prisma, SubscriberStatus } from "../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";
import { logger, maskPhone } from "../config/logger.js";

const providerDate = (timestamp: unknown): Date => {
  const seconds = Number(timestamp);
  return Number.isFinite(seconds) ? new Date(seconds * 1000) : new Date();
};

const normalizePhone = (phone: string): string => phone.trim().replace(/[^\d]/g, "");

const normalizeCommand = (text: string): string => text.trim().replace(/\s+/g, " ").toUpperCase();

const extractText = (message: any): string | null => {
  if (message.type === "text") return message.text?.body || null;
  if (message.type === "button") return message.button?.text || null;
  if (message.type === "interactive") {
    return message.interactive?.button_reply?.title || message.interactive?.list_reply?.title || null;
  }
  return null;
};

export const handleWhatsAppIncoming = async (message: any, contact: any, webhookEventId: number) => {
  if (!message.id || !message.from) return;

  const phoneNumber = normalizePhone(message.from);
  const textBody = extractText(message);
  const command = textBody ? normalizeCommand(textBody) : "";
  const shouldUnsubscribe = ["STOP", "UNSUBSCRIBE", "CANCEL"].includes(command);
  const shouldSubscribe = ["START", "SUBSCRIBE"].includes(command);
  const subscriber = await prisma.subscriber.findUnique({ where: { phoneNumber } });

  await prisma.$transaction(async (tx) => {
    const incoming = await tx.incomingMessage.upsert({
      where: { providerMessageId: message.id },
      update: {},
      create: {
        providerMessageId: message.id,
        phoneNumber,
        subscriberId: subscriber?.id || null,
        waContactId: contact?.wa_id || phoneNumber,
        contactName: contact?.profile?.name || null,
        messageType: message.type || "unsupported",
        textBody,
        interactivePayload: message.type === "interactive" || message.type === "button" ? message as Prisma.InputJsonValue : undefined,
        mediaId: message.image?.id || message.video?.id || message.document?.id || message.audio?.id || null,
        replyToProviderMessageId: message.context?.id || null,
        receivedAt: providerDate(message.timestamp),
        providerTimestamp: providerDate(message.timestamp),
        status: message.type === "unsupported" ? IncomingMessageStatus.IGNORED : IncomingMessageStatus.UNREAD,
        rawWebhookEventId: webhookEventId,
      },
    });

    if (subscriber) {
      await tx.subscriber.update({
        where: { id: subscriber.id },
        data: {
          lastInboundMessageAt: incoming.receivedAt,
          ...(shouldUnsubscribe
            ? {
                optedIn: false,
                status: SubscriberStatus.UNSUBSCRIBED,
                unsubscribedAt: incoming.receivedAt,
                unsubscribeSource: "WHATSAPP_REPLY",
                consentUpdatedAt: incoming.receivedAt,
              }
            : shouldSubscribe
              ? {
                  optedIn: true,
                  status: SubscriberStatus.ACTIVE,
                  optedInAt: incoming.receivedAt,
                  unsubscribedAt: null,
                  unsubscribeSource: null,
                  consentUpdatedAt: incoming.receivedAt,
                }
              : {}),
        },
      });

      if (shouldUnsubscribe || shouldSubscribe) {
        await tx.auditLog.create({
          data: {
            action: shouldUnsubscribe ? "SUBSCRIBER_UNSUBSCRIBED_BY_WHATSAPP_REPLY" : "SUBSCRIBER_RESUBSCRIBED_BY_WHATSAPP_REPLY",
            entityType: "Subscriber",
            entityId: subscriber.id,
            metadata: {
              incomingMessageId: incoming.id,
              webhookEventId,
              phoneNumber: maskPhone(phoneNumber),
            },
          },
        });
      }
    }
  });

  logger.info("[Webhook] Incoming WhatsApp message stored", {
    providerMessageId: message.id,
    phoneNumber: maskPhone(phoneNumber),
    webhookEventId,
    unsubscribed: shouldUnsubscribe,
  });
};
