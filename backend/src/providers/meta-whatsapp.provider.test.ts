import { describe, it, expect, beforeEach, vi } from "vitest";
import type { SendMessageInput } from "./message-provider.js";

/**
 * Regression coverage for the custom-message delivery path.
 *
 * The original defect: send() accepted input.message and never used it, so every
 * recipient received the configured template's fixed text instead of the message
 * the author actually wrote. These tests pin the behaviour that replaced it.
 */

const META_ENV = {
  MESSAGE_PROVIDER: "meta",
  META_WHATSAPP_ACCESS_TOKEN: "test-token",
  META_WHATSAPP_PHONE_NUMBER_ID: "123",
  META_WHATSAPP_BUSINESS_ACCOUNT_ID: "456",
  META_APP_SECRET: "secret",
  META_WEBHOOK_VERIFY_TOKEN: "verify",
  META_GRAPH_API_VERSION: "v21.0",
  WHATSAPP_DEFAULT_TEMPLATE_NAME: "broadcast_alert",
  WHATSAPP_DEFAULT_TEMPLATE_LANGUAGE: "en",
  WHATSAPP_CUSTOMER_SERVICE_WINDOW_HOURS: "24",
};

/** The live broadcast_alert template: fixed text wrapped around one variable. */
const templateWithVariable = {
  name: "broadcast_alert",
  language: "en",
  parameterSchema: { body: ["body_1"] },
};

/** Meta's sample template: fixed text, no variable to carry a custom message. */
const templateWithoutVariable = {
  name: "hello_world",
  language: "en_US",
  parameterSchema: null,
};

const baseInput: SendMessageInput = {
  messageId: 1,
  broadcastId: 10,
  subscriberId: 100,
  phoneNumber: "919876543210",
  message: "meeting in an hr",
};

let sentBodies: any[] = [];

const loadProvider = async () => {
  const { MetaWhatsAppProvider } = await import("./meta-whatsapp.provider.js");
  return new MetaWhatsAppProvider();
};

beforeEach(() => {
  vi.resetModules();
  Object.assign(process.env, META_ENV);
  sentBodies = [];
  vi.stubGlobal("fetch", async (_url: string, init: any) => {
    sentBodies.push(JSON.parse(init.body));
    return {
      ok: true,
      status: 200,
      json: async () => ({ messages: [{ id: "wamid.TEST" }] }),
    };
  });
});

const lastBody = () => sentBodies[sentBodies.length - 1];

describe("MetaWhatsAppProvider custom message delivery", () => {
  it("sends the author's text verbatim while the customer-service window is open", async () => {
    const provider = await loadProvider();

    await provider.send({
      ...baseInput,
      message: "meeting in an hr",
      lastInboundMessageAt: new Date(),
      metadata: {},
    });

    expect(lastBody().type).toBe("text");
    expect(lastBody().text.body).toBe("meeting in an hr");
  });

  it("preserves line breaks on the free-form path", async () => {
    const provider = await loadProvider();

    await provider.send({
      ...baseInput,
      message: "Line one\nLine two",
      lastInboundMessageAt: new Date(),
      metadata: {},
    });

    expect(lastBody().text.body).toBe("Line one\nLine two");
  });

  it("carries the custom message as the template body variable once the window has closed", async () => {
    const provider = await loadProvider();

    await provider.send({
      ...baseInput,
      lastInboundMessageAt: null,
      metadata: { templateSnapshot: templateWithVariable },
    });

    const body = lastBody();
    expect(body.type).toBe("template");
    expect(body.template.name).toBe("broadcast_alert");
    expect(body.template.components[0].parameters[0].text).toBe("meeting in an hr");
  });

  it("treats an inbound message older than the window as closed", async () => {
    const provider = await loadProvider();
    const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000);

    await provider.send({
      ...baseInput,
      lastInboundMessageAt: twentyFiveHoursAgo,
      metadata: { templateSnapshot: templateWithVariable },
    });

    expect(lastBody().type).toBe("template");
  });

  it("treats an inbound message inside the window as open", async () => {
    const provider = await loadProvider();
    const twentyThreeHoursAgo = new Date(Date.now() - 23 * 60 * 60 * 1000);

    await provider.send({
      ...baseInput,
      lastInboundMessageAt: twentyThreeHoursAgo,
      metadata: { templateSnapshot: templateWithVariable },
    });

    expect(lastBody().type).toBe("text");
  });

  it("sanitizes newlines and repeated spaces that Meta rejects in template variables", async () => {
    const provider = await loadProvider();

    await provider.send({
      ...baseInput,
      message: "Water supply cut\n9am-5pm    tomorrow.",
      lastInboundMessageAt: null,
      metadata: { templateSnapshot: templateWithVariable },
    });

    const text = lastBody().template.components[0].parameters[0].text;
    expect(text).toBe("Water supply cut 9am-5pm tomorrow.");
    expect(text).not.toMatch(/\n|\t| {2,}/);
  });

  it("refuses to send when the template has no variable to carry the message", async () => {
    const provider = await loadProvider();

    await expect(
      provider.send({
        ...baseInput,
        lastInboundMessageAt: null,
        metadata: { templateSnapshot: templateWithoutVariable },
      })
    ).rejects.toMatchObject({
      code: "TEMPLATE_HAS_NO_BODY_VARIABLE",
      // Permanent misconfiguration: retrying would waste the retry budget.
      retryable: false,
    });

    // The critical assertion: nothing was delivered. Sending the template's
    // fixed text here is precisely the original bug.
    expect(sentBodies).toHaveLength(0);
  });

  it("does not override an explicitly supplied template variable", async () => {
    const provider = await loadProvider();

    await provider.send({
      ...baseInput,
      lastInboundMessageAt: null,
      metadata: {
        templateSnapshot: templateWithVariable,
        templateVariables: { body_1: "explicit value" },
      },
    });

    expect(lastBody().template.components[0].parameters[0].text).toBe("explicit value");
  });
});
