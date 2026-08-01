import { getMetaConfig } from "../config/env.js";
import { logger, maskPhone } from "../config/logger.js";
import { MessageProvider, SendMessageInput, SendMessageResult } from "./message-provider.js";
import { mapMetaError } from "./meta-error-mapper.js";
import { buildTemplatePayload, TemplateSnapshot, TemplateVariableMap } from "./template-payload.builder.js";

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
    const template = this.resolveTemplate(input);
    const payload = buildTemplatePayload({
      to: recipient,
      template,
      variables: input.metadata?.templateVariables as TemplateVariableMap | undefined,
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

  private resolveTemplate(input: SendMessageInput): TemplateSnapshot {
    const snapshot = input.metadata?.templateSnapshot as TemplateSnapshot | undefined;
    if (snapshot?.name && snapshot.language) {
      return snapshot;
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
