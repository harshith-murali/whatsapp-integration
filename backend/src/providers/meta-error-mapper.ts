import { ClassifiedProviderError } from "./provider-errors.js";

const sanitize = (message: unknown): string => {
  if (typeof message !== "string") return "Meta API request failed";
  return message.replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]").slice(0, 500);
};

export const mapMetaError = (args: {
  status?: number;
  responseBody?: any;
  cause?: unknown;
}): ClassifiedProviderError => {
  const error = args.responseBody?.error || {};
  const providerCode = error.code !== undefined ? String(error.code) : undefined;
  const providerSubcode = error.error_subcode !== undefined ? String(error.error_subcode) : undefined;
  const providerType = error.type !== undefined ? String(error.type) : undefined;
  const message = sanitize(error.message || (args.cause instanceof Error ? args.cause.message : undefined));
  const status = args.status;

  if (!status) {
    return new ClassifiedProviderError({
      message,
      code: "META_NETWORK_ERROR",
      retryable: true,
      category: "retryable",
      providerCode,
      providerSubcode,
      providerType,
    });
  }

  if (status === 401 || status === 403) {
    return new ClassifiedProviderError({
      message,
      code: "META_AUTH_OR_PERMISSION_ERROR",
      retryable: false,
      category: "authentication",
      status,
      providerCode,
      providerSubcode,
      providerType,
    });
  }

  if (status === 429) {
    return new ClassifiedProviderError({
      message,
      code: "META_RATE_LIMIT",
      retryable: true,
      category: "rate_limit",
      status,
      providerCode,
      providerSubcode,
      providerType,
    });
  }

  if (status >= 500) {
    return new ClassifiedProviderError({
      message,
      code: "META_TRANSIENT_ERROR",
      retryable: true,
      category: "retryable",
      status,
      providerCode,
      providerSubcode,
      providerType,
    });
  }

  const lowerMessage = message.toLowerCase();
  const category = lowerMessage.includes("template")
    ? "template"
    : lowerMessage.includes("recipient") || lowerMessage.includes("phone")
      ? "recipient"
      : "permanent";

  return new ClassifiedProviderError({
    message,
    code: category === "template" ? "META_TEMPLATE_ERROR" : category === "recipient" ? "META_RECIPIENT_ERROR" : "META_PERMANENT_ERROR",
    retryable: false,
    category,
    status,
    providerCode,
    providerSubcode,
    providerType,
  });
};
