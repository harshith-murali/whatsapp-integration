import crypto from "crypto";
import { MessageProvider, SendMessageInput, SendMessageResult, MessageProviderError } from "./message-provider.js";
import { logger } from "../config/logger.js";

export class MockWhatsAppProvider implements MessageProvider {
  private minDelay: number;
  private maxDelay: number;
  private retryableRate: number;
  private permanentRate: number;

  constructor() {
    // Parse rates and delay configuration with robust fallback defaults
    this.minDelay = parseInt(process.env.MOCK_PROVIDER_MIN_DELAY_MS || "100", 10);
    this.maxDelay = parseInt(process.env.MOCK_PROVIDER_MAX_DELAY_MS || "500", 10);
    this.retryableRate = parseFloat(process.env.MOCK_PROVIDER_RETRYABLE_FAILURE_RATE || "0.10");
    this.permanentRate = parseFloat(process.env.MOCK_PROVIDER_PERMANENT_FAILURE_RATE || "0.05");

    // Validate values at initialization
    if (isNaN(this.minDelay) || this.minDelay < 0) this.minDelay = 100;
    if (isNaN(this.maxDelay) || this.maxDelay < this.minDelay) this.maxDelay = 500;
    
    if (isNaN(this.retryableRate) || this.retryableRate < 0 || this.retryableRate > 1) {
      throw new Error("MOCK_PROVIDER_RETRYABLE_FAILURE_RATE must be between 0 and 1");
    }
    if (isNaN(this.permanentRate) || this.permanentRate < 0 || this.permanentRate > 1) {
      throw new Error("MOCK_PROVIDER_PERMANENT_FAILURE_RATE must be between 0 and 1");
    }
    if (this.retryableRate + this.permanentRate > 1) {
      throw new Error("Combined failure rates (retryable + permanent) cannot exceed 1.0");
    }
  }

  public async send(input: SendMessageInput): Promise<SendMessageResult> {
    // Mask phone number for non-sensitive logging
    const maskPhone = (phone: string): string => {
      if (phone.length <= 4) return "••••";
      return phone.slice(0, -4).replace(/./g, "•") + phone.slice(-4);
    };
    const maskedPhone = maskPhone(input.phoneNumber);

    logger.info(`[MockProvider] Sending to ${maskedPhone}: "${(input.message || "").slice(0, 120)}"`, {
      messageId: input.messageId,
      broadcastId: input.broadcastId,
    });

    // 1. Simulate processing delay
    const delay = Math.floor(Math.random() * (this.maxDelay - this.minDelay + 1)) + this.minDelay;
    await new Promise((resolve) => setTimeout(resolve, delay));

    // 2. Check for development/test deterministic override matches
    const isDevOrTest = process.env.NODE_ENV === "test" || process.env.NODE_ENV === "development" || process.env.DEV_TEST_MODE === "true";
    if (isDevOrTest) {
      if (input.phoneNumber.endsWith("0001")) {
        logger.debug(`[MockProvider] Deterministic SUCCESS for phone ends with 0001 (masked: ${maskedPhone})`);
        return this.createSuccessResult();
      }
      if (input.phoneNumber.endsWith("0002")) {
        logger.debug(`[MockProvider] Deterministic RETRYABLE_FAILURE for phone ends with 0002 (masked: ${maskedPhone})`);
        throw new MessageProviderError("Mock rate limit exceeded", "MOCK_RATE_LIMIT", true);
      }
      if (input.phoneNumber.endsWith("0003")) {
        logger.debug(`[MockProvider] Deterministic PERMANENT_FAILURE for phone ends with 0003 (masked: ${maskedPhone})`);
        throw new MessageProviderError("Mock invalid phone number", "MOCK_INVALID_NUMBER", false);
      }
    }

    // 3. Roll random outcome based on configured rates
    const roll = Math.random();

    if (roll < this.retryableRate) {
      // Retryable errors examples
      const retryableErrors = [
        { msg: "Mock rate limit exceeded", code: "MOCK_RATE_LIMIT" },
        { msg: "Mock connection timeout", code: "MOCK_TIMEOUT" },
        { msg: "Mock service temporarily unavailable", code: "MOCK_TEMPORARY_UNAVAILABLE" }
      ];
      const error = retryableErrors[Math.floor(Math.random() * retryableErrors.length)]!;
      logger.info(`[MockProvider] Simulating retryable failure: ${error.code} for ${maskedPhone}`);
      throw new MessageProviderError(error.msg, error.code, true);
    }

    if (roll < this.retryableRate + this.permanentRate) {
      // Permanent errors examples
      const permanentErrors = [
        { msg: "Mock invalid phone number format", code: "MOCK_INVALID_NUMBER" },
        { msg: "Mock recipient blocked sender", code: "MOCK_RECIPIENT_BLOCKED" },
        { msg: "Mock unsupported destination country", code: "MOCK_UNSUPPORTED_DESTINATION" }
      ];
      const error = permanentErrors[Math.floor(Math.random() * permanentErrors.length)]!;
      logger.warn(`[MockProvider] Simulating permanent failure: ${error.code} for ${maskedPhone}`);
      throw new MessageProviderError(error.msg, error.code, false);
    }

    // Default to success
    return this.createSuccessResult();
  }

  private createSuccessResult(): SendMessageResult {
    return {
      providerMessageId: `mock-wa-${crypto.randomUUID()}`,
      providerName: "mock-whatsapp",
      submittedAt: new Date(),
    };
  }
}
