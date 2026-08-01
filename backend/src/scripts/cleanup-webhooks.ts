import "dotenv/config";
import { prisma } from "../config/prisma.js";
import { getMetaConfig } from "../config/env.js";
import { Prisma } from "../generated/prisma/client.js";

const main = async () => {
  const config = getMetaConfig();
  const cutoff = new Date(Date.now() - config.webhookRetentionDays * 24 * 60 * 60 * 1000);
  const result = await prisma.webhookEvent.updateMany({
    where: {
      receivedAt: { lt: cutoff },
      processingStatus: { in: ["PROCESSED", "IGNORED"] },
      payload: { not: Prisma.JsonNull },
    },
    data: {
      payload: Prisma.JsonNull,
    },
  });
  console.log(`Redacted payload for ${result.count} webhook event(s).`);
};

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
