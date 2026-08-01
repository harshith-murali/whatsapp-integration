import "dotenv/config";
import { prisma } from "../config/prisma.js";
import { getMetaConfig } from "../config/env.js";
import { MessageTemplateStatus, Prisma } from "../generated/prisma/client.js";

const mapStatus = (status: string | undefined): MessageTemplateStatus => {
  const normalized = String(status || "UNKNOWN").toUpperCase();
  return Object.values(MessageTemplateStatus).includes(normalized as MessageTemplateStatus)
    ? (normalized as MessageTemplateStatus)
    : MessageTemplateStatus.UNKNOWN;
};

const main = async () => {
  const config = getMetaConfig();
  if (config.providerMode !== "meta") {
    console.log("Template sync skipped in mock mode.");
    return;
  }

  const url = `${config.apiBaseUrl}/${config.graphApiVersion}/${config.businessAccountId}/message_templates?fields=id,name,language,category,status,components&limit=100`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${config.accessToken}` } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error("Meta template sync failed");

  let synced = 0;
  for (const item of body.data || []) {
    const components = Array.isArray(item.components) ? item.components : [];
    const bodyComponent = components.find((component: any) => component.type === "BODY");
    const footerComponent = components.find((component: any) => component.type === "FOOTER");
    const headerComponent = components.find((component: any) => component.type === "HEADER");
    await prisma.messageTemplate.upsert({
      where: { name_language: { name: item.name, language: item.language } },
      update: {
        metaTemplateId: item.id,
        category: item.category || null,
        status: mapStatus(item.status),
        headerType: headerComponent?.format || null,
        body: bodyComponent?.text || "",
        footer: footerComponent?.text || null,
        components: components as Prisma.InputJsonValue,
        lastSyncedAt: new Date(),
      },
      create: {
        metaTemplateId: item.id,
        name: item.name,
        language: item.language,
        category: item.category || null,
        status: mapStatus(item.status),
        headerType: headerComponent?.format || null,
        body: bodyComponent?.text || "",
        footer: footerComponent?.text || null,
        components: components as Prisma.InputJsonValue,
        lastSyncedAt: new Date(),
      },
    });
    synced++;
  }

  console.log(`Synced ${synced} template(s).`);
};

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
