// src/config/env.ts
// Central environment validation. Called at process startup — any misconfigured
// variable throws immediately so the process refuses to start rather than
// silently misbehaving at runtime.

const isMissing = (value: string | undefined): boolean => !value || value.trim() === "";

const parsePositiveInt = (name: string, fallback: number): number => {
  const raw = process.env[name];
  if (isMissing(raw)) return fallback;

  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer, got: "${raw}"`);
  }

  return value;
};

const parseBoolean = (name: string, fallback: boolean): boolean => {
  const raw = process.env[name];
  if (isMissing(raw)) return fallback;
  if (["true", "1", "yes"].includes(raw!.toLowerCase())) return true;
  if (["false", "0", "no"].includes(raw!.toLowerCase())) return false;
  throw new Error(`${name} must be true or false, got: "${raw}"`);
};

const requireString = (name: string): string => {
  const value = process.env[name];
  if (isMissing(value)) {
    throw new Error(`${name} is required but not set`);
  }
  return value!.trim();
};

const requireWhenMeta = (name: string): string => {
  const value = process.env[name];
  if (isMissing(value)) {
    throw new Error(`${name} is required when MESSAGE_PROVIDER=meta`);
  }
  return value!.trim();
};

// ── Env validation helpers ────────────────────────────────────────────────────

const validateNodeEnv = (): string => {
  const raw = (process.env.NODE_ENV || "").trim();
  if (!raw) {
    console.warn("[env] NODE_ENV is not set — defaulting to 'development'.");
    return "development";
  }
  const allowed = ["development", "test", "production"] as const;
  if (!allowed.includes(raw as (typeof allowed)[number])) {
    throw new Error(`NODE_ENV must be one of: ${allowed.join(", ")}. Got: "${raw}"`);
  }
  return raw;
};

const validateDatabaseUrl = (nodeEnv: string): string => {
  const url = process.env.DATABASE_URL;
  if (isMissing(url)) {
    throw new Error("DATABASE_URL is required");
  }
  const trimmed = url!.trim();
  if (!/^mysql2?:\/\//i.test(trimmed)) {
    throw new Error(
      `DATABASE_URL must start with mysql:// or mysql2://, got: "${trimmed.slice(0, 20)}..."`
    );
  }
  if (nodeEnv === "production" && trimmed.includes("localhost")) {
    console.warn(
      "[env] WARNING: DATABASE_URL points to localhost in production. " +
      "Ensure this is intentional — for AWS RDS set DATABASE_URL to your RDS endpoint."
    );
  }
  return trimmed;
};

const validateJwtSecret = (nodeEnv: string): string => {
  const secret = process.env.JWT_SECRET;
  if (isMissing(secret)) {
    throw new Error("JWT_SECRET is required");
  }
  const trimmed = secret!.trim();
  const minLength = nodeEnv === "production" ? 64 : 32;
  if (trimmed.length < minLength) {
    throw new Error(
      `JWT_SECRET must be at least ${minLength} characters in ${nodeEnv}. ` +
      `Got ${trimmed.length} characters.`
    );
  }
  return trimmed;
};

const validateCorsOrigins = (nodeEnv: string): string[] => {
  const raw = process.env.CORS_ALLOWED_ORIGINS || process.env.FRONTEND_URL || "";
  const origins = raw
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  if (nodeEnv === "production") {
    if (origins.length === 0) {
      throw new Error(
        "CORS_ALLOWED_ORIGINS must be explicitly set in production " +
        "(e.g. https://yourdomain.com). It cannot be empty."
      );
    }
    if (origins.includes("*")) {
      throw new Error(
        "CORS_ALLOWED_ORIGINS must not contain a wildcard (*) in production. " +
        "Provide explicit origin URLs."
      );
    }
    for (const origin of origins) {
      if (!origin.startsWith("https://")) {
        console.warn(
          `[env] WARNING: CORS origin "${origin}" does not use HTTPS. ` +
          "Ensure production traffic is served over TLS."
        );
      }
    }
  }

  return origins.length > 0 ? origins : ["http://localhost:5173"];
};

// ── Public API ────────────────────────────────────────────────────────────────

export type MessageProviderMode = "mock" | "meta";

export const getMessageProviderMode = (): MessageProviderMode => {
  const mode = (process.env.MESSAGE_PROVIDER || "mock").toLowerCase();
  if (mode !== "mock" && mode !== "meta") {
    throw new Error(`MESSAGE_PROVIDER must be either "mock" or "meta". Got: "${mode}"`);
  }
  return mode;
};

export const getWebhookPath = (): string =>
  process.env.META_WEBHOOK_PATH?.trim() || "/api/webhooks/whatsapp";

export const getMetaConfig = () => {
  const providerMode = getMessageProviderMode();
  const graphApiVersion = process.env.META_GRAPH_API_VERSION?.trim() || "";

  if (providerMode === "meta" && !/^v\d+\.\d+$/.test(graphApiVersion)) {
    throw new Error(
      "META_GRAPH_API_VERSION must use a value like v21.0 when MESSAGE_PROVIDER=meta"
    );
  }

  return {
    providerMode,
    apiBaseUrl: process.env.META_API_BASE_URL?.trim() || "https://graph.facebook.com",
    graphApiVersion,
    phoneNumberId:
      providerMode === "meta"
        ? requireWhenMeta("META_WHATSAPP_PHONE_NUMBER_ID")
        : process.env.META_WHATSAPP_PHONE_NUMBER_ID?.trim(),
    businessAccountId:
      providerMode === "meta"
        ? requireWhenMeta("META_WHATSAPP_BUSINESS_ACCOUNT_ID")
        : process.env.META_WHATSAPP_BUSINESS_ACCOUNT_ID?.trim(),
    accessToken:
      providerMode === "meta"
        ? requireWhenMeta("META_WHATSAPP_ACCESS_TOKEN")
        : process.env.META_WHATSAPP_ACCESS_TOKEN?.trim(),
    appSecret:
      providerMode === "meta"
        ? requireWhenMeta("META_APP_SECRET")
        : process.env.META_APP_SECRET?.trim(),
    webhookVerifyToken:
      providerMode === "meta"
        ? requireWhenMeta("META_WEBHOOK_VERIFY_TOKEN")
        : process.env.META_WEBHOOK_VERIFY_TOKEN?.trim(),
    webhookPath: getWebhookPath(),
    requestTimeoutMs: parsePositiveInt("META_REQUEST_TIMEOUT_MS", 15000),
    defaultTemplateLanguage:
      process.env.WHATSAPP_DEFAULT_TEMPLATE_LANGUAGE?.trim() || "en",
    defaultTemplateName: process.env.WHATSAPP_DEFAULT_TEMPLATE_NAME?.trim() || "",
    webhookBatchSize: parsePositiveInt("WEBHOOK_PROCESSING_BATCH_SIZE", 25),
    webhookRetentionDays: parsePositiveInt("WEBHOOK_RETENTION_DAYS", 30),
    customerServiceWindowHours: parsePositiveInt(
      "WHATSAPP_CUSTOMER_SERVICE_WINDOW_HOURS",
      24
    ),
  };
};

export const maskIdentifier = (value: string | undefined | null): string | null => {
  if (!value) return null;
  if (value.length <= 4) return "****";
  return `${value.slice(0, 2)}${"*".repeat(Math.max(2, value.length - 6))}${value.slice(-4)}`;
};

export const getAppConfig = () => {
  const nodeEnv = validateNodeEnv();
  const databaseUrl = validateDatabaseUrl(nodeEnv);
  const jwtSecret = validateJwtSecret(nodeEnv);
  const corsAllowedOrigins = validateCorsOrigins(nodeEnv);

  // In production, COOKIE_SECURE defaults to true and cannot be overridden to false
  const cookieSecureRaw = parseBoolean("COOKIE_SECURE", nodeEnv === "production");
  const cookieSecure = nodeEnv === "production" ? true : cookieSecureRaw;

  if (nodeEnv === "production" && !cookieSecureRaw) {
    console.warn(
      "[env] WARNING: COOKIE_SECURE=false was set but overridden to true in production."
    );
  }

  // Database SSL — defaults to true in production (required for AWS RDS)
  const databaseSsl = parseBoolean("DATABASE_SSL", nodeEnv === "production");
  if (nodeEnv === "production" && !databaseSsl) {
    console.warn(
      "[env] WARNING: DATABASE_SSL=false in production. " +
      "AWS RDS requires SSL. Set DATABASE_SSL=true unless you have certificate auth disabled."
    );
  }

  return {
    port: parsePositiveInt("PORT", 3000),
    nodeEnv,
    databaseUrl,
    databaseSsl,
    databaseConnectionLimit: parsePositiveInt("DATABASE_CONNECTION_LIMIT", 10),
    databaseConnectTimeoutMs: parsePositiveInt("DATABASE_CONNECT_TIMEOUT_MS", 10000),
    frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
    trustProxy: parseBoolean("TRUST_PROXY", nodeEnv === "production"),
    jwtSecret,
    sessionDurationHours: parsePositiveInt("SESSION_DURATION_HOURS", 8),
    cookieDomain: process.env.COOKIE_DOMAIN || undefined,
    cookieSecure,
    cookieSameSite: (process.env.COOKIE_SAME_SITE || "lax") as "lax" | "strict" | "none",
    corsAllowedOrigins,
    rateLimitWindowMs: parsePositiveInt("RATE_LIMIT_WINDOW_MS", 60_000),
    rateLimitMaxRequests: parsePositiveInt("RATE_LIMIT_MAX_REQUESTS", 300),
    loginRateLimitMax: parsePositiveInt("LOGIN_RATE_LIMIT_MAX", 5),
    webhookRateLimitMax: parsePositiveInt("WEBHOOK_RATE_LIMIT_MAX", 1000),
    logDirectory: process.env.LOG_DIRECTORY || "logs",
    logRetentionDays: parsePositiveInt("LOG_RETENTION_DAYS", 30),
    idempotencyTtlHours: parsePositiveInt("IDEMPOTENCY_TTL_HOURS", 24),
    cleanupBatchSize: parsePositiveInt("CLEANUP_BATCH_SIZE", 500),
    workerHeartbeatRetentionDays: parsePositiveInt("WORKER_HEARTBEAT_RETENTION_DAYS", 14),
    messageAttemptRetentionDays: parsePositiveInt("MESSAGE_ATTEMPT_RETENTION_DAYS", 30),
  };
};
