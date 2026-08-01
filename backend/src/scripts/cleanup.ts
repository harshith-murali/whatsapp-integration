import "dotenv/config";
import { prisma } from "../config/prisma.js";
import { getAppConfig, getMetaConfig } from "../config/env.js";
import { logger } from "../config/logger.js";
import { WebhookProcessingStatus } from "../generated/prisma/client.js";

const dryRun = process.argv.includes("--dry-run");
const target = process.argv.find((arg) => arg.startsWith("--target="))?.split("=")[1] || "all";

const cutoff = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

const report = async (name: string, count: number, action: () => Promise<{ count: number }>) => {
  if (dryRun) {
    logger.info(`[Cleanup] ${name} dry run`, { count });
    return count;
  }
  const result = await action();
  logger.info(`[Cleanup] ${name} completed`, { count: result.count });
  return result.count;
};

const cleanupWebhooks = async () => {
  const config = getMetaConfig();
  const where = {
    receivedAt: { lt: cutoff(config.webhookRetentionDays) },
    processingStatus: { in: [WebhookProcessingStatus.PROCESSED, WebhookProcessingStatus.IGNORED] },
  };
  const count = await prisma.webhookEvent.count({ where });
  return report("webhooks", count, () => prisma.webhookEvent.deleteMany({ where }));
};

const cleanupWorkers = async () => {
  const config = getAppConfig();
  const where = { lastHeartbeatAt: { lt: cutoff(config.workerHeartbeatRetentionDays) } };
  const count = await prisma.workerHeartbeat.count({ where });
  return report("workers", count, () => prisma.workerHeartbeat.deleteMany({ where }));
};

const cleanupAttempts = async () => {
  const config = getAppConfig();
  const where = { createdAt: { lt: cutoff(config.messageAttemptRetentionDays) } };
  const count = await prisma.messageAttempt.count({ where });
  return report("attempts", count, () => prisma.messageAttempt.deleteMany({ where }));
};

const cleanupIdempotency = async () => {
  const where = { expiresAt: { lt: new Date() } };
  const count = await prisma.idempotencyKey.count({ where });
  return report("idempotency", count, () => prisma.idempotencyKey.deleteMany({ where }));
};

const main = async () => {
  if (target === "webhooks" || target === "all") await cleanupWebhooks();
  if (target === "workers" || target === "all") await cleanupWorkers();
  if (target === "attempts" || target === "all") await cleanupAttempts();
  if (target === "idempotency" || target === "all") await cleanupIdempotency();
};

main()
  .catch((error) => {
    logger.error("[Cleanup] Failed", { error });
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
