import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";
import { hashPayload } from "./webhook-verification.js";
import { WhatsAppWebhookPayload } from "./webhook-types.js";

export const getWebhookEventKeys = (payload: WhatsAppWebhookPayload, payloadHash: string): string[] => {
  const keys: string[] = [];

  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value;
      for (const status of value?.statuses || []) {
        const keyParts = [
          "status",
          status.id,
          status.status,
          status.timestamp,
          status.errors?.[0]?.code,
        ].filter(Boolean);
        if (keyParts.length >= 3) keys.push(keyParts.join(":"));
      }
      for (const message of value?.messages || []) {
        if (message.id) keys.push(`incoming:${message.id}`);
      }
    }
  }

  return keys.length > 0 ? keys : [`payload:${payloadHash}`];
};

export const createWebhookEvents = async (args: {
  payload: WhatsAppWebhookPayload;
  rawBody: Buffer;
  signatureValid: boolean;
}) => {
  const payloadHash = hashPayload(args.rawBody);
  const eventKeys = getWebhookEventKeys(args.payload, payloadHash);
  const events = [];

  for (const eventKey of eventKeys) {
    try {
      const event = await prisma.webhookEvent.create({
        data: {
          eventKey,
          objectType: args.payload.object || "whatsapp_business_account",
          provider: "meta-whatsapp-cloud-api",
          payloadHash,
          payload: args.payload as Prisma.InputJsonValue,
          signatureValid: args.signatureValid,
        },
      });
      events.push(event);
    } catch (error: any) {
      if (error?.code === "P2002") {
        const existing = await prisma.webhookEvent.findUnique({ where: { eventKey } });
        if (existing) events.push(existing);
      } else {
        throw error;
      }
    }
  }

  return events;
};
