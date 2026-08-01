import { Request, Response, NextFunction } from "express";
import { prisma } from "../config/prisma.js";
import { getMetaConfig, maskIdentifier } from "../config/env.js";

export const getWhatsAppIntegrationStatus = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const config = getMetaConfig();
    const [templateCount, latestTemplate, latestWebhook] = await Promise.all([
      prisma.messageTemplate.count({ where: { status: "APPROVED" } }),
      prisma.messageTemplate.findFirst({ orderBy: { lastSyncedAt: "desc" } }),
      prisma.webhookEvent.findFirst({ where: { signatureValid: true }, orderBy: { receivedAt: "desc" } }),
    ]);

    res.json({
      success: true,
      data: {
        providerMode: config.providerMode,
        configured:
          config.providerMode === "mock" ||
          Boolean(config.graphApiVersion && config.phoneNumberId && config.businessAccountId && config.accessToken && config.appSecret),
        graphApiVersion: config.graphApiVersion || null,
        phoneNumberIdMasked: maskIdentifier(config.phoneNumberId),
        wabaIdMasked: maskIdentifier(config.businessAccountId),
        webhookPath: config.webhookPath,
        templateCount,
        lastTemplateSyncAt: latestTemplate?.lastSyncedAt || null,
        lastValidWebhookAt: latestWebhook?.receivedAt || null,
      },
    });
  } catch (error) {
    next(error);
  }
};
