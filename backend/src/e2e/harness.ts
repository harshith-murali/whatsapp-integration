/**
 * Shared E2E harness.
 *
 * Environment must be set before any application module is imported, because
 * config/env.ts and the providers read process.env at module load.
 */

const PORT = 3399;

process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.DATABASE_URL =
  process.env.E2E_DATABASE_URL || `mysql://root:e2eroot@127.0.0.1:${PORT}/whatsapp_e2e`;
process.env.JWT_SECRET =
  process.env.JWT_SECRET || "e2e-test-jwt-secret-value-that-is-long-enough-to-pass-validation";
process.env.MESSAGE_PROVIDER = "meta";
process.env.META_WHATSAPP_ACCESS_TOKEN = "e2e-token";
process.env.META_WHATSAPP_PHONE_NUMBER_ID = "1234567890";
process.env.META_WHATSAPP_BUSINESS_ACCOUNT_ID = "9876543210";
process.env.META_APP_SECRET = "e2e-app-secret";
process.env.META_WEBHOOK_VERIFY_TOKEN = "e2e-verify-token";
process.env.META_GRAPH_API_VERSION = "v21.0";
process.env.WHATSAPP_DEFAULT_TEMPLATE_NAME = "broadcast_alert";
process.env.WHATSAPP_DEFAULT_TEMPLATE_LANGUAGE = "en";
process.env.WHATSAPP_CUSTOMER_SERVICE_WINDOW_HOURS = "24";
// Keep rate limiting from interfering with rapid test requests.
process.env.RATE_LIMIT_MAX_REQUESTS = "100000";
process.env.LOGIN_RATE_LIMIT_MAX = "100000";
process.env.LOG_LEVEL = process.env.LOG_LEVEL || "error";

import request from "supertest";
import bcrypt from "bcryptjs";
import type { Express } from "express";

export type Agent = {
  app: Express;
  cookies: string[];
  csrfToken: string;
};

export const loadApp = async (): Promise<Express> => {
  const { app } = await import("../app.js");
  return app;
};

export const getPrisma = async () => {
  const { prisma } = await import("../config/prisma.js");
  return prisma;
};

/**
 * Truncates all data tables between tests. Foreign key checks are disabled for
 * the duration so tables can be cleared regardless of relation order.
 */
export const resetDatabase = async () => {
  const prisma = await getPrisma();
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, string>>>(
    "SELECT table_name AS t FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'"
  );
  const tables = rows
    .map((row) => row.t ?? row.T ?? Object.values(row)[0])
    .filter((name): name is string => Boolean(name) && name !== "_prisma_migrations");

  // FOREIGN_KEY_CHECKS is a session variable, so the disable and the truncates
  // must run on one connection. A transaction pins them to the same session.
  await prisma.$transaction([
    prisma.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 0"),
    ...tables.map((table) => prisma.$executeRawUnsafe(`TRUNCATE TABLE \`${table}\``)),
    prisma.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 1"),
  ]);
};

export const createAdmin = async (args: {
  email: string;
  password: string;
  role: "SUPER_ADMIN" | "ADMIN" | "OPERATOR" | "VIEWER";
  name?: string;
}) => {
  const prisma = await getPrisma();
  return prisma.admin.create({
    data: {
      name: args.name || args.email.split("@")[0]!,
      email: args.email,
      passwordHash: await bcrypt.hash(args.password, 10),
      role: args.role,
      isActive: true,
    },
  });
};

const collectCookies = (raw: unknown): string[] =>
  Array.isArray(raw) ? raw.map((cookie) => String(cookie).split(";")[0]!) : [];

/**
 * Performs the real login flow: fetch a CSRF token, then POST credentials.
 * Returns the cookie jar and CSRF token needed for authenticated writes.
 */
export const login = async (
  app: Express,
  email: string,
  password: string
): Promise<Agent> => {
  const csrfResponse = await request(app).get("/api/auth/csrf");
  const csrfCookies = collectCookies(csrfResponse.headers["set-cookie"]);
  const csrfToken = csrfResponse.body?.data?.csrfToken;

  const loginResponse = await request(app)
    .post("/api/auth/login")
    .set("Cookie", csrfCookies)
    .set("x-csrf-token", csrfToken)
    .send({ email, password });

  if (loginResponse.status !== 200) {
    throw new Error(
      `E2E login failed (${loginResponse.status}): ${JSON.stringify(loginResponse.body)}`
    );
  }

  const authCookies = collectCookies(loginResponse.headers["set-cookie"]);
  const jar = new Map<string, string>();
  for (const cookie of [...csrfCookies, ...authCookies]) {
    jar.set(cookie.split("=")[0]!, cookie);
  }

  return { app, cookies: [...jar.values()], csrfToken };
};

export const authed = (agent: Agent) => ({
  get: (url: string) => request(agent.app).get(url).set("Cookie", agent.cookies),
  post: (url: string) =>
    request(agent.app)
      .post(url)
      .set("Cookie", agent.cookies)
      .set("x-csrf-token", agent.csrfToken),
  put: (url: string) =>
    request(agent.app)
      .put(url)
      .set("Cookie", agent.cookies)
      .set("x-csrf-token", agent.csrfToken),
  patch: (url: string) =>
    request(agent.app)
      .patch(url)
      .set("Cookie", agent.cookies)
      .set("x-csrf-token", agent.csrfToken),
  delete: (url: string) =>
    request(agent.app)
      .delete(url)
      .set("Cookie", agent.cookies)
      .set("x-csrf-token", agent.csrfToken),
});

/** Captures outbound Meta HTTP calls instead of contacting Meta. */
export const stubMetaApi = () => {
  const calls: any[] = [];
  const original = globalThis.fetch;

  globalThis.fetch = (async (url: string, init: any) => {
    calls.push({ url: String(url), body: init?.body ? JSON.parse(init.body) : null });
    return {
      ok: true,
      status: 200,
      json: async () => ({
        messages: [{ id: `wamid.E2E${calls.length}` }],
      }),
    };
  }) as unknown as typeof fetch;

  return {
    calls,
    restore: () => {
      globalThis.fetch = original;
    },
  };
};
