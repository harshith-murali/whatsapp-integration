import { describe, it, expect } from "vitest";
import { buildTemplatePayload } from "./template-payload.builder.js";

const template = {
  name: "broadcast_alert",
  language: "en",
  parameterSchema: { body: ["body_1"] },
};

describe("buildTemplatePayload", () => {
  it("builds the Meta Cloud API payload with the message as a body parameter", () => {
    const payload = buildTemplatePayload({
      to: "919876543210",
      template,
      variables: { body_1: "meeting in an hr" },
    });

    expect(payload).toEqual({
      messaging_product: "whatsapp",
      to: "919876543210",
      type: "template",
      template: {
        name: "broadcast_alert",
        language: { code: "en" },
        components: [
          { type: "body", parameters: [{ type: "text", text: "meeting in an hr" }] },
        ],
      },
    });
  });

  it("emits header parameters before body parameters", () => {
    const payload = buildTemplatePayload({
      to: "919876543210",
      template: {
        name: "with_header",
        language: "en",
        parameterSchema: { header: ["header_1"], body: ["body_1"] },
      },
      variables: { header_1: "Alert", body_1: "Body" },
    }) as any;

    expect(payload.template.components.map((c: any) => c.type)).toEqual(["header", "body"]);
  });

  it("omits components entirely for templates without variables", () => {
    const payload = buildTemplatePayload({
      to: "919876543210",
      template: { name: "hello_world", language: "en_US", parameterSchema: null },
    }) as any;

    expect(payload.template.components).toBeUndefined();
  });

  it("rejects a missing variable rather than sending a partial message", () => {
    expect(() =>
      buildTemplatePayload({ to: "919876543210", template, variables: {} })
    ).toThrow(/Missing template variable/);
  });

  it("rejects a blank variable", () => {
    expect(() =>
      buildTemplatePayload({ to: "919876543210", template, variables: { body_1: "   " } })
    ).toThrow(/cannot be empty/);
  });

  it("rejects unexpected variables that the template cannot render", () => {
    expect(() =>
      buildTemplatePayload({
        to: "919876543210",
        template,
        variables: { body_1: "ok", stray: "value" },
      })
    ).toThrow(/Unexpected template variables/);
  });
});
