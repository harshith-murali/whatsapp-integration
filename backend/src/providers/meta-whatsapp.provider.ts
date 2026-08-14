import { getMetaConfig } from "../config/env.js";
import { logger, maskPhone } from "../config/logger.js";
import {
  MessageProvider,
  MessageProviderError,
  SendMessageInput,
  SendMessageResult,
} from "./message-provider.js";
import { mapMetaError } from "./meta-error-mapper.js";
import { buildTemplatePayload, TemplateSnapshot, TemplateVariableMap } from "./template-payload.builder.js";

/**
 * Meta rejects template variables containing newlines, tabs, or 4+ consecutive
 * spaces, so multi-line broadcast copy is collapsed to single-spaced text before
 * it is used as a template parameter. Free-form sends keep their formatting.
 */
const sanitizeTemplateVariable = (value: string): string =>
  value.replace(/\s*\n\s*/g, " ").replace(/\t/g, " ").replace(/ {2,}/g, " ").trim();

const normalizePhone = (phone: string): string => {
  const normalized = phone.trim().replace(/[^\d]/g, "");
  if (normalized.length < 8 || normalized.length > 15) {
    throw new Error("Recipient phone number must be in E.164-compatible digits-only form");
  }
  return normalized;
};

export class MetaWhatsAppProvider implements MessageProvider {
  private readonly config = getMetaConfig();

  async send(input: SendMessageInput): Promise<SendMessageResult> {
    const startedAt = Date.now();
    const recipient = normalizePhone(input.phoneNumber);
    const customMessage = (input.message || "").trim();

    // Inside the customer-service window WhatsApp permits free-form messages, so
    // the author's text can be delivered verbatim with no template wrapper.
    if (customMessage && this.isWindowOpen(input.lastInboundMessageAt)) {
      logger.info("[MetaProvider] Sending free-form message (customer-service window open)", {
        messageId: input.messageId,
        broadcastId: input.broadcastId,
        provider: "meta-whatsapp-cloud-api",
        phoneNumber: maskPhone(recipient),
      });
      return this.sendTextMessage({ to: recipient, text: customMessage });
    }

    // Outside the window Meta requires an approved template, so the custom text
    // has to travel as a body variable of that template.
    const template = this.resolveTemplate(input);
    const variables = this.buildVariables(input, template, customMessage);
    const payload = buildTemplatePayload({
      to: recipient,
      template,
      variables,
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);
    const url = `${this.config.apiBaseUrl}/${this.config.graphApiVersion}/${this.config.phoneNumberId}/messages`;

    logger.info("[MetaProvider] Sending WhatsApp template message", {
      messageId: input.messageId,
      broadcastId: input.broadcastId,
      provider: "meta-whatsapp-cloud-api",
      phoneNumber: maskPhone(recipient),
      templateName: template.name,
    });

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw mapMetaError({ status: response.status, responseBody: body });
      }

      const wamid = body?.messages?.[0]?.id;
      if (typeof wamid !== "string" || wamid.trim() === "") {
        throw mapMetaError({
          status: response.status,
          responseBody: { error: { message: "Meta response did not include messages[0].id" } },
        });
      }

      logger.info("[MetaProvider] WhatsApp template accepted", {
        messageId: input.messageId,
        broadcastId: input.broadcastId,
        providerMessageId: wamid,
        durationMs: Date.now() - startedAt,
      });

      return {
        providerMessageId: wamid,
        providerName: "meta-whatsapp-cloud-api",
        submittedAt: new Date(),
      };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw mapMetaError({ cause: new Error("Meta request timed out") });
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async sendTextMessage(args: { to: string; text: string }): Promise<SendMessageResult> {
    const recipient = normalizePhone(args.to);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);
    const url = `${this.config.apiBaseUrl}/${this.config.graphApiVersion}/${this.config.phoneNumberId}/messages`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: recipient,
          type: "text",
          text: { preview_url: false, body: args.text },
        }),
        signal: controller.signal,
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw mapMetaError({ status: response.status, responseBody: body });
      }
      const wamid = body?.messages?.[0]?.id;
      if (typeof wamid !== "string") {
        throw mapMetaError({ status: response.status, responseBody: { error: { message: "Meta response did not include messages[0].id" } } });
      }
      return {
        providerMessageId: wamid,
        providerName: "meta-whatsapp-cloud-api",
        submittedAt: new Date(),
      };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw mapMetaError({ cause: new Error("Meta request timed out") });
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private isWindowOpen(lastInboundMessageAt?: Date | null): boolean {
    if (!lastInboundMessageAt) return false;
    const expiresAt =
      lastInboundMessageAt.getTime() + this.config.customerServiceWindowHours * 60 * 60 * 1000;
    return expiresAt > Date.now();
  }

  /**
   * Merges the broadcast's custom message into the template's variables. The
   * message fills the first body placeholder unless the broadcast already
   * supplies an explicit value for it.
   */
  private buildVariables(
    input: SendMessageInput,
    template: TemplateSnapshot,
    customMessage: string
  ): TemplateVariableMap {
    const explicit = (input.metadata?.templateVariables as TemplateVariableMap | null) || {};
    const bodyParams = template.parameterSchema?.body || [];

    if (!customMessage) {
      return explicit;
    }

    if (bodyParams.length === 0) {
      // The template is a fixed-text one (e.g. Meta's `hello_world` sample), so
      // there is nowhere to put the author's message. Failing here is required:
      // sending anyway would deliver canned text while reporting success.
      throw new MessageProviderError(
        `Template "${template.name}" (${template.language}) has no body variable, so the custom broadcast message cannot be delivered. ` +
          `Create and get approval for a WhatsApp template whose body contains a {{1}} placeholder, set WHATSAPP_DEFAULT_TEMPLATE_NAME to it, then run "npm run templates:sync".`,
        "TEMPLATE_HAS_NO_BODY_VARIABLE",
        false
      );
    }

    const firstBodyParam = bodyParams[0] as string;
    if (explicit[firstBodyParam] !== undefined && explicit[firstBodyParam] !== null) {
      return explicit;
    }

    return { ...explicit, [firstBodyParam]: sanitizeTemplateVariable(customMessage) };
  }

  private resolveTemplate(input: SendMessageInput): TemplateSnapshot {
    const snapshot = input.metadata?.templateSnapshot as TemplateSnapshot | undefined;
    if (snapshot?.name && snapshot.language) {
      return snapshot;
    }

    const broadcastTemplateName = input.metadata?.templateName;
    const broadcastTemplateLanguage = input.metadata?.templateLanguage;
    if (
      typeof broadcastTemplateName === "string" &&
      broadcastTemplateName.trim() &&
      typeof broadcastTemplateLanguage === "string" &&
      broadcastTemplateLanguage.trim()
    ) {
      return {
        name: broadcastTemplateName.trim(),
        language: broadcastTemplateLanguage.trim(),
        parameterSchema: null,
      };
    }

    const templateName = this.config.defaultTemplateName;
    if (!templateName) {
      throw new Error("Broadcast has no template snapshot and WHATSAPP_DEFAULT_TEMPLATE_NAME is not configured");
    }

    return {
      name: templateName,
      language: this.config.defaultTemplateLanguage,
      parameterSchema: null,
    };
  }
}
