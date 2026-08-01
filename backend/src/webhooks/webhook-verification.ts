import crypto from "crypto";
import { Request } from "express";
import { getMetaConfig } from "../config/env.js";

export const verifyWebhookChallenge = (query: Request["query"]): string | null => {
  const config = getMetaConfig();
  const mode = query["hub.mode"];
  const token = query["hub.verify_token"];
  const challenge = query["hub.challenge"];

  if (mode === "subscribe" && token === config.webhookVerifyToken && typeof challenge === "string") {
    return challenge;
  }

  return null;
};

export const verifyMetaSignature = (rawBody: Buffer | undefined, signature: string | undefined): boolean => {
  const config = getMetaConfig();
  if (!rawBody || !signature || !signature.startsWith("sha256=") || !config.appSecret) {
    return false;
  }

  const actualHex = signature.slice("sha256=".length);
  if (!/^[a-f0-9]{64}$/i.test(actualHex)) {
    return false;
  }

  const expectedHex = crypto
    .createHmac("sha256", config.appSecret)
    .update(rawBody)
    .digest("hex");

  const actual = Buffer.from(actualHex, "hex");
  const expected = Buffer.from(expectedHex, "hex");

  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
};

export const hashPayload = (rawBody: Buffer): string =>
  crypto.createHash("sha256").update(rawBody).digest("hex");
