import { Request, Response, NextFunction } from "express";
import { prisma } from "../config/prisma.js";
import { getMessageProviderMode } from "../config/env.js";

export const readiness = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      success: true,
      status: "ready",
      checks: {
        database: "ok",
        providerMode: getMessageProviderMode(),
      },
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      status: "not_ready",
      checks: { database: "unavailable" },
    });
  }
};

export const healthDetails = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [workers, queuedMessages, failedWebhooks, latestWebhook] = await Promise.all([
      prisma.workerHeartbeat.count({
        where: { status: "RUNNING", lastHeartbeatAt: { gte: new Date(Date.now() - 60_000) } },
      }),
      prisma.message.count({ where: { status: "QUEUED" } }),
      prisma.webhookEvent.count({ where: { processingStatus: "FAILED" } }),
      prisma.webhookEvent.findFirst({ where: { signatureValid: true }, orderBy: { receivedAt: "desc" } }),
    ]);

    res.json({
      success: true,
      data: {
        database: "ok",
        providerMode: getMessageProviderMode(),
        activeWorkerCount: workers,
        queuedMessages,
        failedWebhookCount: failedWebhooks,
        lastValidWebhookAt: latestWebhook?.receivedAt || null,
      },
    });
  } catch (error) {
    next(error);
  }
};
