import "dotenv/config";
import { getMetaConfig } from "../config/env.js";
import { logger } from "../config/logger.js";
import { prisma } from "../config/prisma.js";
import { processPendingWebhookEvents } from "../webhooks/webhook-processor.js";

const config = getMetaConfig();
const intervalMs = Number(process.env.WEBHOOK_WORKER_POLL_INTERVAL_MS || 2000);
let shuttingDown = false;

const tick = async () => {
  if (shuttingDown) return;
  try {
    const processed = await processPendingWebhookEvents(config.webhookBatchSize);
    if (processed > 0) {
      logger.info("[WebhookWorker] Processed webhook batch", { processed });
    }
  } catch (error) {
    logger.error("[WebhookWorker] Processing cycle failed", { error });
  } finally {
    if (!shuttingDown) setTimeout(tick, intervalMs);
  }
};

const shutdown = async (signal: string) => {
  shuttingDown = true;
  logger.info("[WebhookWorker] Shutting down", { signal });
  await prisma.$disconnect();
  process.exit(0);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

logger.info("[WebhookWorker] Starting webhook worker");
tick();
