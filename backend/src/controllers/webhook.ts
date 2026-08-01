import { Request, Response, NextFunction } from "express";
import { logger } from "../config/logger.js";
import { createWebhookEvents } from "../webhooks/webhook-event.service.js";
import { verifyMetaSignature, verifyWebhookChallenge } from "../webhooks/webhook-verification.js";
import { processWebhookEvent } from "../webhooks/webhook-processor.js";

export const verifyWhatsAppWebhook = (req: Request, res: Response): void => {
  const challenge = verifyWebhookChallenge(req.query);
  if (!challenge) {
    logger.warn("[Webhook] WhatsApp webhook verification failed");
    res.sendStatus(403);
    return;
  }

  logger.info("[Webhook] WhatsApp webhook verification succeeded");
  res.status(200).send(challenge);
};

export const receiveWhatsAppWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const signature = req.header("x-hub-signature-256");
    const signatureValid = verifyMetaSignature(req.rawBody, signature);
    if (!signatureValid) {
      logger.warn("[Webhook] WhatsApp webhook signature invalid", { hasSignature: Boolean(signature) });
      res.sendStatus(401);
      return;
    }

    const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body));
    const events = await createWebhookEvents({
      payload: req.body,
      rawBody,
      signatureValid,
    });

    res.status(200).json({ success: true });

    for (const event of events) {
      processWebhookEvent(event.id).catch((error) => {
        logger.error("[Webhook] Async processing failed", {
          webhookEventId: event.id,
          error,
        });
      });
    }
  } catch (error) {
    next(error);
  }
};
