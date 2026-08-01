const isMissing = (value: string | undefined): boolean => !value || value.trim() === "";

const parsePositiveInt = (name: string, fallback: number): number => {
  const raw = process.env[name];
  if (isMissing(raw)) return fallback;

  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return value;
};

const parseBoolean = (name: string, fallback: boolean): boolean => {
  const raw = process.env[name];
  if (isMissing(raw)) return fallback;
  if (["true", "1", "yes"].includes(raw!.toLowerCase())) return true;
  if (["false", "0", "no"].includes(raw!.toLowerCase())) return false;
  throw new Error(`${name} must be true or false`);
};

const requireWhenMeta = (name: string): string => {
  const value = process.env[name];
  if (isMissing(value)) {
    throw new Error(`${name} is required when MESSAGE_PROVIDER=meta`);
  }
  return value!.trim();
};

export type MessageProviderMode = "mock" | "meta";

export const getMessageProviderMode = (): MessageProviderMode => {
  const mode = (process.env.MESSAGE_PROVIDER || "mock").toLowerCase();
  if (mode !== "mock" && mode !== "meta") {
    throw new Error("MESSAGE_PROVIDER must be either mock or meta");
  }
  return mode;
};

export const getWebhookPath = (): string =>
  process.env.META_WEBHOOK_PATH?.trim() || "/api/webhooks/whatsapp";

export const getMetaConfig = () => {
  const providerMode = getMessageProviderMode();
  const graphApiVersion = process.env.META_GRAPH_API_VERSION?.trim() || "";

  if (providerMode === "meta" && !/^v\d+\.\d+$/.test(graphApiVersion)) {
    throw new Error("META_GRAPH_API_VERSION must use a value like v21.0 when MESSAGE_PROVIDER=meta");
  }

  return {
    providerMode,
    apiBaseUrl: process.env.META_API_BASE_URL?.trim() || "https://graph.facebook.com",
    graphApiVersion,
    phoneNumberId: providerMode === "meta" ? requireWhenMeta("META_WHATSAPP_PHONE_NUMBER_ID") : process.env.META_WHATSAPP_PHONE_NUMBER_ID?.trim(),
    businessAccountId: providerMode === "meta" ? requireWhenMeta("META_WHATSAPP_BUSINESS_ACCOUNT_ID") : process.env.META_WHATSAPP_BUSINESS_ACCOUNT_ID?.trim(),
    accessToken: providerMode === "meta" ? requireWhenMeta("META_WHATSAPP_ACCESS_TOKEN") : process.env.META_WHATSAPP_ACCESS_TOKEN?.trim(),
    appSecret: providerMode === "meta" ? requireWhenMeta("META_APP_SECRET") : process.env.META_APP_SECRET?.trim(),
    webhookVerifyToken: providerMode === "meta" ? requireWhenMeta("META_WEBHOOK_VERIFY_TOKEN") : process.env.META_WEBHOOK_VERIFY_TOKEN?.trim(),
    webhookPath: getWebhookPath(),
    requestTimeoutMs: parsePositiveInt("META_REQUEST_TIMEOUT_MS", 15000),
    defaultTemplateLanguage: process.env.WHATSAPP_DEFAULT_TEMPLATE_LANGUAGE?.trim() || "en",
    defaultTemplateName: process.env.WHATSAPP_DEFAULT_TEMPLATE_NAME?.trim() || "",
    webhookBatchSize: parsePositiveInt("WEBHOOK_PROCESSING_BATCH_SIZE", 25),
    webhookRetentionDays: parsePositiveInt("WEBHOOK_RETENTION_DAYS", 30),
    customerServiceWindowHours: parsePositiveInt("WHATSAPP_CUSTOMER_SERVICE_WINDOW_HOURS", 24),
  };
};

export const maskIdentifier = (value: string | undefined | null): string | null => {
  if (!value) return null;
  if (value.length <= 4) return "****";
  return `${value.slice(0, 2)}${"*".repeat(Math.max(2, value.length - 6))}${value.slice(-4)}`;
};

export const getAppConfig = () => {
  const nodeEnv = process.env.NODE_ENV || "development";
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || (nodeEnv === "production" && jwtSecret.length < 32)) {
    throw new Error("JWT_SECRET must be configured and at least 32 characters long in production");
  }

  const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || process.env.FRONTEND_URL || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (nodeEnv === "production" && allowedOrigins.length === 0) {
    throw new Error("CORS_ALLOWED_ORIGINS must be configured in production");
  }

  return {
    port: parsePositiveInt("PORT", 3000),
    nodeEnv,
    frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
    trustProxy: parseBoolean("TRUST_PROXY", nodeEnv === "production"),
    jwtSecret,
    sessionDurationHours: parsePositiveInt("SESSION_DURATION_HOURS", 8),
    cookieDomain: process.env.COOKIE_DOMAIN || undefined,
    cookieSecure: parseBoolean("COOKIE_SECURE", nodeEnv === "production"),
    cookieSameSite: (process.env.COOKIE_SAME_SITE || "lax") as "lax" | "strict" | "none",
    corsAllowedOrigins: allowedOrigins,
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
