import { Request, Response, NextFunction } from "express";
import { prisma } from "../config/prisma.js";
import { getMetaConfig } from "../config/env.js";
import { MessageTemplateStatus, Prisma } from "../generated/prisma/client.js";
import { BadRequestError } from "../utils/errors.js";
import {
  extractBody,
  extractFooter,
  extractHeaderType,
  extractParameterSchema,
} from "../providers/template-components.js";

const mapStatus = (status: string | undefined): MessageTemplateStatus => {
  const normalized = String(status || "UNKNOWN").toUpperCase();
  return Object.values(MessageTemplateStatus).includes(normalized as MessageTemplateStatus)
    ? (normalized as MessageTemplateStatus)
    : MessageTemplateStatus.UNKNOWN;
};

export const getTemplates = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const templates = await prisma.messageTemplate.findMany({
      orderBy: [{ status: "asc" }, { name: "asc" }],
    });
    res.json({ success: true, data: templates });
  } catch (error) {
    next(error);
  }
};

export const getTemplateById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new BadRequestError("Invalid template ID");
    const template = await prisma.messageTemplate.findUnique({ where: { id } });
    if (!template) throw new BadRequestError("Template not found");
    res.json({ success: true, data: template });
  } catch (error) {
    next(error);
  }
};

export const syncTemplates = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const config = getMetaConfig();
    if (config.providerMode !== "meta") {
      res.json({ success: true, data: { synced: 0, message: "Template sync skipped in mock mode." } });
      return;
    }

    const url = `${config.apiBaseUrl}/${config.graphApiVersion}/${config.businessAccountId}/message_templates?fields=id,name,language,category,status,components&limit=100`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${config.accessToken}` },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new BadRequestError("Meta template sync failed");
    }

    let synced = 0;
    for (const item of body.data || []) {
      const components = Array.isArray(item.components) ? item.components : [];
      await prisma.messageTemplate.upsert({
        where: {
          name_language: {
            name: item.name,
            language: item.language,
          },
        },
        update: {
          metaTemplateId: item.id,
          category: item.category || null,
          status: mapStatus(item.status),
          headerType: extractHeaderType(components),
          body: extractBody(components),
          footer: extractFooter(components),
          components: components as Prisma.InputJsonValue,
          parameterSchema: extractParameterSchema(components) as Prisma.InputJsonValue,
          lastSyncedAt: new Date(),
        },
        create: {
          metaTemplateId: item.id,
          name: item.name,
          language: item.language,
          category: item.category || null,
          status: mapStatus(item.status),
          headerType: extractHeaderType(components),
          body: extractBody(components),
          footer: extractFooter(components),
          components: components as Prisma.InputJsonValue,
          parameterSchema: extractParameterSchema(components) as Prisma.InputJsonValue,
          lastSyncedAt: new Date(),
        },
      });
      synced++;
    }

    res.json({ success: true, data: { synced } });
  } catch (error) {
    next(error);
  }
};
