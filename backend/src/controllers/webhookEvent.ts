import { Request, Response, NextFunction } from "express";
import { prisma } from "../config/prisma.js";
import { BadRequestError, ConflictError, NotFoundError } from "../utils/errors.js";
import { processWebhookEvent } from "../webhooks/webhook-processor.js";
import { WebhookProcessingStatus } from "../generated/prisma/client.js";

export const replayWebhookEvent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new BadRequestError("Invalid webhook event ID");
    const event = await prisma.webhookEvent.findUnique({ where: { id } });
    if (!event) throw new NotFoundError("Webhook event not found");
    if (!event.signatureValid) throw new BadRequestError("Only valid-signature webhook events can be replayed");
    if (event.processingStatus === WebhookProcessingStatus.PROCESSING) {
      throw new ConflictError("Webhook event is currently processing");
    }

    await prisma.webhookEvent.update({
      where: { id },
      data: { processingStatus: WebhookProcessingStatus.RECEIVED },
    });
    await processWebhookEvent(id);

    res.json({ success: true, data: { id } });
  } catch (error) {
    next(error);
  }
};
