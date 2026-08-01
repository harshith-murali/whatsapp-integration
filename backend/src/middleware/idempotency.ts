import crypto from "crypto";
import { Request, Response, NextFunction } from "express";
import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";
import { ConflictError } from "../utils/errors.js";
import { getAppConfig } from "../config/env.js";

const hashRequest = (body: unknown): string =>
  crypto.createHash("sha256").update(JSON.stringify(body || {})).digest("hex");

export const idempotencyMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!["POST", "PATCH", "PUT", "DELETE"].includes(req.method)) return next();
    const key = req.header("Idempotency-Key");
    if (!key) return next();
    if (!/^[A-Za-z0-9._:-]{8,128}$/.test(key)) {
      throw new ConflictError("Invalid Idempotency-Key format");
    }

    const route = `${req.method} ${req.baseUrl || ""}${req.route?.path || req.path}`;
    const requestHash = hashRequest(req.body);
    const existing = await prisma.idempotencyKey.findUnique({
      where: { key_route: { key, route } },
    });

    if (existing) {
      if (existing.requestHash !== requestHash) {
        throw new ConflictError("Idempotency-Key was reused with a different request");
      }
      if (existing.status === "COMPLETED" && existing.responseStatus && existing.responseBody) {
        res.status(existing.responseStatus).json(existing.responseBody);
        return;
      }
      throw new ConflictError("A request with this Idempotency-Key is still processing");
    }

    const config = getAppConfig();
    const record = await prisma.idempotencyKey.create({
      data: {
        key,
        route,
        requestHash,
        adminId: req.admin?.id || null,
        expiresAt: new Date(Date.now() + config.idempotencyTtlHours * 60 * 60 * 1000),
      },
    });

    const originalJson = res.json.bind(res);
    res.json = ((body: any) => {
      if (res.statusCode >= 200 && res.statusCode < 500) {
        prisma.idempotencyKey
          .update({
            where: { id: record.id },
            data: {
              status: "COMPLETED",
              responseStatus: res.statusCode,
              responseBody: body as Prisma.InputJsonValue,
            },
          })
          .catch(() => undefined);
      }
      return originalJson(body);
    }) as typeof res.json;

    next();
  } catch (error) {
    next(error);
  }
};
