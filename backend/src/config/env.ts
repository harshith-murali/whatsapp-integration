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
