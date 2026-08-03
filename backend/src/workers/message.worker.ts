import "dotenv/config";
import crypto from "crypto";
import os from "os";
import { prisma } from "../config/prisma.js";
import { MessageStatus, BroadcastStatus, WorkerStatus, MessageAttemptResult, MessageStatusEventSource } from "../generated/prisma/client.js";
import { MessageProviderFactory } from "../providers/provider-factory.js";
import { MessageProviderError } from "../providers/message-provider.js";
import { logger } from "../config/logger.js";

// Validate Worker Configurations
const WORKER_ID = process.env.WORKER_ID || `worker-${os.hostname()}-${process.pid}-${crypto.randomBytes(3).toString("hex")}`;
const POLL_INTERVAL = parseInt(process.env.WORKER_POLL_INTERVAL_MS || "2000", 10);
const BATCH_SIZE = parseInt(process.env.WORKER_BATCH_SIZE || "20", 10);
const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || "5", 10);
const CLAIM_TTL = parseInt(process.env.WORKER_CLAIM_TTL_MS || "60000", 10);
const MAX_RETRIES = parseInt(process.env.WORKER_MAX_RETRIES || "3", 10);
const SHUTDOWN_TIMEOUT = parseInt(process.env.WORKER_SHUTDOWN_TIMEOUT_MS || "5000", 10);

if (isNaN(POLL_INTERVAL) || POLL_INTERVAL < 500) {
  logger.error("WORKER_POLL_INTERVAL_MS must be at least 500ms");
  process.exit(1);
}
if (isNaN(BATCH_SIZE) || BATCH_SIZE <= 0) {
  logger.error("WORKER_BATCH_SIZE must be a positive integer");
  process.exit(1);
}
if (isNaN(CONCURRENCY) || CONCURRENCY <= 0 || CONCURRENCY > BATCH_SIZE) {
  logger.error("WORKER_CONCURRENCY must be positive and <= WORKER_BATCH_SIZE");
  process.exit(1);
}
if (isNaN(CLAIM_TTL) || CLAIM_TTL < 10000) {
  logger.error("WORKER_CLAIM_TTL_MS must be at least 10000ms");
  process.exit(1);
}
if (isNaN(MAX_RETRIES) || MAX_RETRIES < 0 || MAX_RETRIES > 10) {
  logger.error("WORKER_MAX_RETRIES must be between 0 and 10");
  process.exit(1);
}

// Runtime stats trackers
let isRunning = false;
let isShuttingDown = false;
let processedCount = 0;
let successCount = 0;
let failedCount = 0;
let activeInFlightJobs = 0;
let pollTimeout: NodeJS.Timeout | null = null;
let heartbeatInterval: NodeJS.Timeout | null = null;

// Clean up stale claims recovered helper
async function recoverStaleClaims() {
  try {
    const now = new Date();
    const staleMessages = await prisma.message.findMany({
      where: {
        status: MessageStatus.PROCESSING,
        claimExpiresAt: { lt: now },
      },
    });

    if (staleMessages.length === 0) return;

    logger.info(`[Worker] Found ${staleMessages.length} stale messages to recover.`);

    for (const msg of staleMessages) {
      const isExhausted = msg.retryCount >= msg.maxRetries;
      
      await prisma.$transaction(async (tx: any) => {
        if (isExhausted) {
          await tx.message.update({
            where: { id: msg.id },
            data: {
              status: MessageStatus.FAILED,
              failedAt: now,
              errorCode: "CLAIM_EXPIRED_RETRY_EXHAUSTED",
              errorMessage: "Processing claim expired and max retries were exhausted",
              workerId: null,
              claimToken: null,
              claimExpiresAt: null,
            },
          });
        } else {
          await tx.message.update({
            where: { id: msg.id },
            data: {
              status: MessageStatus.QUEUED,
              nextRetryAt: new Date(Date.now() + 10000), // Retry in 10s
              workerId: null,
              claimToken: null,
              claimExpiresAt: null,
            },
          });
        }

        await tx.messageStatusEvent.create({
          data: {
            messageId: msg.id,
            status: isExhausted ? MessageStatus.FAILED : MessageStatus.QUEUED,
            previousStatus: MessageStatus.PROCESSING,
            workerId: WORKER_ID,
            errorCode: isExhausted ? "CLAIM_EXPIRED_RETRY_EXHAUSTED" : "CLAIM_RECOVERED",
            metadata: { reason: "Processing claim expired", expiredAt: msg.claimExpiresAt },
          },
        });
      });

      await recalculateBroadcastStatus(msg.broadcastId);
    }

    // Single audit log for stale recovery run
    await prisma.auditLog.create({
      data: {
        action: "WORKER_STALE_CLAIMS_RECOVERED",
        entityType: "Worker",
        entityId: 0,
        metadata: { workerId: WORKER_ID, recoveredCount: staleMessages.length },
      },
    });

    logger.info(`[Worker] Successfully recovered ${staleMessages.length} stale claims.`);
  } catch (error) {
    logger.error("[Worker] Error during stale claim recovery:", { error });
  }
}

// Parent Broadcast Recalculation Engine
async function recalculateBroadcastStatus(broadcastId: number) {
  try {
    await prisma.$transaction(async (tx: any) => {
      const broadcast = await tx.broadcast.findUnique({
        where: { id: broadcastId },
      });

      if (!broadcast) return;
      if (broadcast.status === BroadcastStatus.CANCELLED) return; // Never overwrite cancelled state

      const aggregates = await tx.message.groupBy({
        by: ["status"],
        where: { broadcastId },
        _count: { id: true },
      });

      const counts: Record<string, number> = {
        QUEUED: 0,
        PROCESSING: 0,
        SUBMITTED: 0,
        FAILED: 0,
        CANCELLED: 0,
        SENT: 0,
        DELIVERED: 0,
        READ: 0,
      };

      for (const group of aggregates) {
        counts[group.status] = group._count.id;
      }

      const total = broadcast.totalRecipients || await tx.message.count({ where: { broadcastId } });
      const queuedCount = counts.QUEUED || 0;
      const processingCount = counts.PROCESSING || 0;
      const submittedCount = counts.SUBMITTED || 0;
      const failedCount = counts.FAILED || 0;
      const cancelledCount = counts.CANCELLED || 0;

      const terminalCount = submittedCount + failedCount + cancelledCount;

      let newStatus: BroadcastStatus = broadcast.status;
      const now = new Date();
      const updateData: any = {};

      if (terminalCount === total) {
        if (submittedCount > 0 && failedCount > 0) {
          newStatus = BroadcastStatus.PARTIALLY_FAILED;
        } else if (failedCount === total) {
          newStatus = BroadcastStatus.FAILED;
          updateData.failedAt = now;
        } else {
          newStatus = BroadcastStatus.COMPLETED;
        }
        updateData.completedAt = now;
      } else {
        if (terminalCount > 0 || processingCount > 0) {
          newStatus = BroadcastStatus.PROCESSING;
          if (!broadcast.processingStartedAt) {
            updateData.processingStartedAt = now;
          }
        }
      }

      if (newStatus !== broadcast.status) {
        updateData.status = newStatus;
        await tx.broadcast.update({
          where: { id: broadcastId },
          data: updateData,
        });

        let auditAction = "";
        if (newStatus === BroadcastStatus.PROCESSING && !broadcast.processingStartedAt) {
          auditAction = "BROADCAST_PROCESSING_STARTED";
        } else if (newStatus === BroadcastStatus.COMPLETED) {
          auditAction = "BROADCAST_COMPLETED";
        } else if (newStatus === BroadcastStatus.PARTIALLY_FAILED) {
          auditAction = "BROADCAST_PARTIALLY_FAILED";
        } else if (newStatus === BroadcastStatus.FAILED) {
          auditAction = "BROADCAST_FAILED";
        }

        if (auditAction) {
          await tx.auditLog.create({
            data: {
              action: auditAction,
              entityType: "Broadcast",
              entityId: broadcastId,
              metadata: {
                submittedCount,
                failedCount,
                cancelledCount,
                total,
              },
            },
          });
        }
      }
    });
  } catch (error) {
    logger.error(`[Worker] Error recalculating broadcast ID ${broadcastId}:`, { error });
  }
}

// Atomically Claim Eligible Messages inside Transaction
async function claimBatch(): Promise<{ messages: any[]; claimToken: string }> {
  const claimToken = crypto.randomUUID();
  const now = new Date();
  const claimExpiresAt = new Date(now.getTime() + CLAIM_TTL);

  try {
    return await prisma.$transaction(async (tx: any) => {
      // Find messages eligible for claiming
      const eligible = await tx.message.findMany({
        where: {
          status: MessageStatus.QUEUED,
          AND: [
            {
              OR: [
                { nextRetryAt: null },
                { nextRetryAt: { lte: now } },
              ],
            },
            {
              OR: [
                { claimExpiresAt: null },
                { claimExpiresAt: { lte: now } },
              ],
            },
          ],
          broadcast: {
            status: {
              in: [BroadcastStatus.QUEUED, BroadcastStatus.PROCESSING, BroadcastStatus.APPROVED],
            },
          },
        },
        orderBy: { createdAt: "asc" },
        take: BATCH_SIZE,
        select: { id: true },
      });

      if (eligible.length === 0) {
        return { messages: [], claimToken };
      }

      const ids = eligible.map((e: any) => e.id);

      // Perform atomic update claiming them
      const result = await tx.message.updateMany({
        where: {
          id: { in: ids },
          status: MessageStatus.QUEUED,
          OR: [
            { claimExpiresAt: null },
            { claimExpiresAt: { lte: now } },
          ],
        },
        data: {
          status: MessageStatus.PROCESSING,
          workerId: WORKER_ID,
          claimToken,
          claimExpiresAt,
          processingStartedAt: now,
          lastAttemptAt: now,
        },
      });

      if (result.count === 0) {
        return { messages: [], claimToken };
      }

      // Query full claimed rows matching claimToken
      const claimed = await tx.message.findMany({
        where: {
          id: { in: ids },
          claimToken,
          status: MessageStatus.PROCESSING,
        },
        include: {
          broadcast: true,
          subscriber: true,
        },
      });

      return { messages: claimed, claimToken };
    });
  } catch (error) {
    logger.error("[Worker] Error claiming batch:", { error });
    return { messages: [], claimToken };
  }
}

// Backoff delay calculation policy
function calculateNextRetryAt(retryCount: number): Date {
  const now = Date.now();
  let delayMs = 30000;

  if (retryCount === 1) {
    delayMs = parseInt(process.env.RETRY_DELAY_ATTEMPT_1_MS || "30000", 10);
  } else if (retryCount === 2) {
    delayMs = parseInt(process.env.RETRY_DELAY_ATTEMPT_2_MS || "120000", 10);
  } else if (retryCount === 3) {
    delayMs = parseInt(process.env.RETRY_DELAY_ATTEMPT_3_MS || "600000", 10);
  }

  return new Date(now + delayMs);
}

// Safe Phone Masking for logs
function maskPhone(phone: string): string {
  if (phone.length <= 4) return "••••";
  return phone.slice(0, -4).replace(/./g, "•") + phone.slice(-4);
}

// Message processor job
async function processMessage(message: any) {
  const start = Date.now();
  const provider = MessageProviderFactory.getProvider();
  const maskedNumber = maskPhone(message.phoneNumber);
  let attemptId: number | null = null;

  logger.info(`[Worker] Started processing Message ID ${message.id} for ${maskedNumber}`, {
    workerId: WORKER_ID,
    messageId: message.id,
    broadcastId: message.broadcastId,
  });

  try {
    // 1. Verify parent broadcast is not cancelled
    if (message.broadcast.status === BroadcastStatus.CANCELLED) {
      logger.info(`[Worker] Message ID ${message.id} cancelled. Parent broadcast was cancelled.`);
      await prisma.$transaction(async (tx: any) => {
        await tx.message.update({
          where: { id: message.id },
          data: {
            status: MessageStatus.CANCELLED,
            cancelledAt: new Date(),
            workerId: null,
            claimToken: null,
            claimExpiresAt: null,
          },
        });
        await tx.messageStatusEvent.create({
          data: {
            messageId: message.id,
            status: MessageStatus.CANCELLED,
            previousStatus: MessageStatus.PROCESSING,
            workerId: WORKER_ID,
            metadata: { reason: "Parent broadcast cancelled" },
          },
        });
      });
      await recalculateBroadcastStatus(message.broadcastId);
      return;
    }

    // 2. Call provider send abstraction
    const attempt = await prisma.messageAttempt.create({
      data: {
        messageId: message.id,
        attemptNumber: message.retryCount + 1,
        provider: process.env.MESSAGE_PROVIDER || "mock",
      },
    });
    attemptId = attempt.id;

    const result = await provider.send({
      messageId: message.id,
      broadcastId: message.broadcastId,
      subscriberId: message.subscriberId,
      phoneNumber: message.phoneNumber,
      message: message.broadcast.message,
      metadata: {
        templateSnapshot: message.broadcast.templateSnapshot,
        templateName: message.broadcast.templateName,
        templateLanguage: message.broadcast.templateLanguage,
        templateVariables: message.broadcast.templateVariables,
      },
    });

    // 3. Record SUCCESS
    const duration = Date.now() - start;
    logger.info(`[Worker] Message ID ${message.id} successfully processed in ${duration}ms`, {
      workerId: WORKER_ID,
      messageId: message.id,
      broadcastId: message.broadcastId,
      durationMs: duration,
    });

    await prisma.$transaction(async (tx: any) => {
      await tx.message.update({
        where: { id: message.id },
        data: {
          status: MessageStatus.SUBMITTED,
          submittedAt: result.submittedAt,
          providerMessageId: result.providerMessageId,
          providerName: result.providerName,
          errorCode: null,
          errorMessage: null,
          workerId: null,
          claimToken: null,
          claimExpiresAt: null,
        },
      });

      await tx.messageStatusEvent.create({
        data: {
          messageId: message.id,
          status: MessageStatus.SUBMITTED,
          newStatus: MessageStatus.SUBMITTED,
          previousStatus: MessageStatus.PROCESSING,
          source: MessageStatusEventSource.WORKER,
          workerId: WORKER_ID,
          metadata: { providerName: result.providerName, durationMs: duration },
        },
      });

      await tx.messageAttempt.update({
        where: { id: attempt.id },
        data: {
          requestCompletedAt: new Date(),
          result: MessageAttemptResult.SUCCESS,
          providerMessageId: result.providerMessageId,
        },
      });

      await tx.subscriber.update({
        where: { id: message.subscriberId },
        data: { lastOutboundMessageAt: result.submittedAt },
      });
    });

    successCount++;
    processedCount++;
    await recalculateBroadcastStatus(message.broadcastId);

  } catch (error: any) {
    const duration = Date.now() - start;
    const isRetryable = error instanceof MessageProviderError ? error.retryable : true;
    const errCode = error.code || "PROVIDER_ERROR";
    const errMsg = (error.message || "Unknown error").substring(0, 500);

    logger.warn(`[Worker] Message ID ${message.id} failed in ${duration}ms. Retryable: ${isRetryable}`, {
      workerId: WORKER_ID,
      messageId: message.id,
      broadcastId: message.broadcastId,
      errorCode: errCode,
      durationMs: duration,
    });

    await prisma.$transaction(async (tx: any) => {
      const currentRetry = message.retryCount + 1;
      const willRetry = isRetryable && currentRetry <= MAX_RETRIES;

      const attemptData = {
        requestCompletedAt: new Date(),
        result: willRetry ? MessageAttemptResult.RETRYABLE_FAILURE : MessageAttemptResult.PERMANENT_FAILURE,
        errorCode: errCode,
        retryable: isRetryable,
      };

      if (attemptId) {
        await tx.messageAttempt.update({
          where: { id: attemptId },
          data: attemptData,
        });
      } else {
        await tx.messageAttempt.create({
          data: {
            messageId: message.id,
            attemptNumber: currentRetry,
            provider: process.env.MESSAGE_PROVIDER || "mock",
            ...attemptData,
          },
        });
      }

      if (willRetry) {
        // Schedule retry with backoff
        const nextRetry = calculateNextRetryAt(currentRetry);
        await tx.message.update({
          where: { id: message.id },
          data: {
            status: MessageStatus.QUEUED,
            retryCount: currentRetry,
            nextRetryAt: nextRetry,
            errorCode: errCode,
            errorMessage: errMsg,
            workerId: null,
            claimToken: null,
            claimExpiresAt: null,
          },
        });

        await tx.messageStatusEvent.create({
          data: {
            messageId: message.id,
            status: MessageStatus.QUEUED,
            newStatus: MessageStatus.QUEUED,
            previousStatus: MessageStatus.PROCESSING,
            source: MessageStatusEventSource.WORKER,
            workerId: WORKER_ID,
            errorCode: errCode,
            metadata: { retryAttempt: currentRetry, nextRetryAt: nextRetry, error: errMsg },
          },
        });
      } else {
        // Mark FAILED
        await tx.message.update({
          where: { id: message.id },
          data: {
            status: MessageStatus.FAILED,
            failedAt: new Date(),
            errorCode: isRetryable ? "RETRIES_EXHAUSTED" : errCode,
            errorMessage: isRetryable ? `Retries exhausted after ${MAX_RETRIES} attempts. Final error: ${errMsg}` : errMsg,
            failureCategory: isRetryable ? "RETRIES_EXHAUSTED" : "PERMANENT_PROVIDER_FAILURE",
            requiresManualReview: true,
            deadLetteredAt: new Date(),
            workerId: null,
            claimToken: null,
            claimExpiresAt: null,
          },
        });

        await tx.messageStatusEvent.create({
          data: {
            messageId: message.id,
            status: MessageStatus.FAILED,
            newStatus: MessageStatus.FAILED,
            previousStatus: MessageStatus.PROCESSING,
            source: MessageStatusEventSource.WORKER,
            workerId: WORKER_ID,
            errorCode: isRetryable ? "RETRIES_EXHAUSTED" : errCode,
            metadata: { error: errMsg, retryCount: message.retryCount },
          },
        });

        failedCount++;
      }
    });

    processedCount++;
    await recalculateBroadcastStatus(message.broadcastId);
  }
}

// Process claimed batch with bounded concurrency
async function processBatch(messages: any[]) {
  activeInFlightJobs = messages.length;
  
  for (let i = 0; i < messages.length; i += CONCURRENCY) {
    if (isShuttingDown) break;
    const chunk = messages.slice(i, i + CONCURRENCY);
    await Promise.all(chunk.map((msg) => processMessage(msg)));
    activeInFlightJobs -= chunk.length;
  }
  
  activeInFlightJobs = 0;
}

// Background poller cycle
async function pollCycle() {
  if (isShuttingDown) return;

  try {
    const { messages } = await claimBatch();

    if (messages.length > 0) {
      logger.info(`[Worker] Claimed batch of ${messages.length} messages.`);
      await processBatch(messages);
    }
  } catch (error) {
    logger.error("[Worker] Error during polling cycle:", { error });
  }

  // Schedule next poll cycle if still active
  if (isRunning && !isShuttingDown) {
    pollTimeout = setTimeout(pollCycle, POLL_INTERVAL);
  }
}

// Periodic Worker Heartbeat writer
async function updateHeartbeat(status: WorkerStatus) {
  try {
    await prisma.workerHeartbeat.upsert({
      where: { workerId: WORKER_ID },
      update: {
        status,
        lastHeartbeatAt: new Date(),
        currentBatchSize: BATCH_SIZE,
        processedCount,
        successCount,
        failedCount,
      },
      create: {
        workerId: WORKER_ID,
        providerName: process.env.MESSAGE_PROVIDER || "mock",
        status,
        hostname: os.hostname(),
        processId: process.pid,
        currentBatchSize: BATCH_SIZE,
        processedCount,
        successCount,
        failedCount,
      },
    });
  } catch (error) {
    logger.error("[Worker] Failed to write worker heartbeat:", { error });
  }
}

// Start daemon service
async function startWorker() {
  logger.info(`[Worker] Starting message worker daemon with ID: ${WORKER_ID}`);
  isRunning = true;
  
  await updateHeartbeat(WorkerStatus.STARTING);

  // Run stale claim recovery at boot
  await recoverStaleClaims();

  await updateHeartbeat(WorkerStatus.RUNNING);

  // Start periodic heartbeat every 5s
  heartbeatInterval = setInterval(() => updateHeartbeat(WorkerStatus.RUNNING), 5000);

  // Start poller loop
  pollCycle();
}

// Graceful Shutdown handler
async function shutdown(signal: string) {
  if (isShuttingDown) return;
  
  logger.info(`[Worker] Received shutdown signal ${signal}. Starting graceful shutdown...`);
  isShuttingDown = true;
  isRunning = false;

  if (pollTimeout) clearTimeout(pollTimeout);
  if (heartbeatInterval) clearInterval(heartbeatInterval);

  await updateHeartbeat(WorkerStatus.STOPPING);

  // Wait for in-flight tasks up to SHUTDOWN_TIMEOUT
  const start = Date.now();
  while (activeInFlightJobs > 0 && Date.now() - start < SHUTDOWN_TIMEOUT) {
    logger.info(`[Worker] Waiting for ${activeInFlightJobs} in-flight jobs to complete...`);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  if (activeInFlightJobs > 0) {
    logger.warn(`[Worker] Shutdown timeout exceeded. Leaving ${activeInFlightJobs} jobs claimed to expire naturally.`);
  }

  try {
    await updateHeartbeat(WorkerStatus.STOPPED);
    await prisma.$disconnect();
    logger.info("[Worker] Graceful shutdown complete. Exiting.");
    process.exit(0);
  } catch (error) {
    logger.error("[Worker] Error during database disconnect on shutdown:", { error });
    process.exit(1);
  }
}

// Hook OS interrupts
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// Run the daemon
startWorker().catch((error) => {
  logger.error("[Worker] Fatal startup crash:", { error });
  process.exit(1);
});
