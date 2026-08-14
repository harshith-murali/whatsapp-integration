import "dotenv/config";
import { app } from "./app.js";
import { prisma } from "./config/prisma.js";
import { logger } from "./config/logger.js";

const PORT = Number(process.env.PORT ?? 3000);
// Must exceed the load balancer idle timeout so the LB stops sending traffic
// before the process stops accepting it (ALB defaults to 60s).
const SHUTDOWN_TIMEOUT = Number(process.env.API_SHUTDOWN_TIMEOUT_MS ?? 15000);

const server = app.listen(PORT, () => {
  logger.info(`API listening on port ${PORT}`, { port: PORT, env: process.env.NODE_ENV });
});

// Keep-alive slightly above the ALB idle timeout avoids races where the LB
// reuses a connection the server is simultaneously closing (502s during deploys).
server.keepAliveTimeout = Number(process.env.API_KEEPALIVE_TIMEOUT_MS ?? 65000);
server.headersTimeout = server.keepAliveTimeout + 5000;

let shuttingDown = false;

const shutdown = async (signal: string) => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`Received ${signal}. Draining connections...`);

  const forceExit = setTimeout(() => {
    logger.error("Shutdown timed out. Forcing exit.");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT);
  forceExit.unref();

  server.close(async (error) => {
    if (error) {
      logger.error("Error while closing HTTP server", { error });
    }
    try {
      await prisma.$disconnect();
      logger.info("Shutdown complete.");
      process.exit(error ? 1 : 0);
    } catch (disconnectError) {
      logger.error("Error disconnecting Prisma", { error: disconnectError });
      process.exit(1);
    }
  });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// A process in an unknown state must not keep serving traffic; exit and let the
// orchestrator replace it.
process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection", { reason });
  shutdown("unhandledRejection");
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception", { error });
  shutdown("uncaughtException");
});
