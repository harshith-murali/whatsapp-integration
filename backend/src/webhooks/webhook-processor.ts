import { WebhookProcessingStatus } from "../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";
import { logger } from "../config/logger.js";
import { handleWhatsAppStatus } from "./whatsapp-status.handler.js";
import { handleWhatsAppIncoming } from "./whatsapp-incoming.handler.js";
import { WhatsAppWebhookPayload } from "./webhook-types.js";

export const processWebhookEvent = async (eventId: number) => {
  const event = await prisma.webhookEvent.update({
    where: { id: eventId },
    data: {
      processingStatus: WebhookProcessingStatus.PROCESSING,
      processingAttempts: { increment: 1 },
    },
  });

  try {
    const payload = event.payload as WhatsAppWebhookPayload;
    let handled = 0;

    for (const entry of payload.entry || []) {
      for (const change of entry.changes || []) {
        const contactsByWaId = new Map((change.value?.contacts || []).map((contact: any) => [contact.wa_id, contact]));

        for (const status of change.value?.statuses || []) {
          await handleWhatsAppStatus(status, event.id);
          handled++;
        }

        for (const message of change.value?.messages || []) {
          await handleWhatsAppIncoming(message, contactsByWaId.get(message.from), event.id);
          handled++;
        }
      }
    }

    await prisma.webhookEvent.update({
      where: { id: event.id },
      data: {
        processingStatus: handled > 0 ? WebhookProcessingStatus.PROCESSED : WebhookProcessingStatus.IGNORED,
        processedAt: new Date(),
        errorMessage: null,
      },
    });
  } catch (error: any) {
    await prisma.webhookEvent.update({
      where: { id: event.id },
      data: {
        processingStatus: WebhookProcessingStatus.FAILED,
        errorMessage: (error?.message || "Webhook processing failed").slice(0, 500),
      },
    });
    logger.error("[Webhook] Processing failed", { webhookEventId: event.id, error });
    throw error;
  }
};

export const processPendingWebhookEvents = async (limit = 25) => {
  const events = await prisma.webhookEvent.findMany({
    where: {
      signatureValid: true,
      processingStatus: { in: [WebhookProcessingStatus.RECEIVED, WebhookProcessingStatus.FAILED] },
    },
    orderBy: { receivedAt: "asc" },
    take: limit,
  });

  for (const event of events) {
    await processWebhookEvent(event.id);
  }

  return events.length;
};
