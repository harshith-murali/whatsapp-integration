import { describe, it, expect } from "vitest";
import {
  extractBody,
  extractFooter,
  extractHeaderType,
  extractParameterSchema,
} from "./template-components.js";

describe("extractParameterSchema", () => {
  it("derives a body variable from the live broadcast_alert template", () => {
    const components = [
      { type: "BODY", text: "Notice from Pranasya Technologies\n{{1}} \nThank You." },
    ];
    expect(extractParameterSchema(components)).toEqual({ body: ["body_1"] });
  });

  it("returns null for fixed-text templates that cannot carry a custom message", () => {
    expect(extractParameterSchema([{ type: "BODY", text: "Hello World" }])).toBeNull();
  });

  it("orders placeholders numerically rather than lexically", () => {
    // A string sort would place {{10}} before {{2}} and mis-map every parameter.
    const components = [{ type: "BODY", text: "{{1}} {{2}} {{10}}" }];
    expect(extractParameterSchema(components)).toEqual({
      body: ["body_1", "body_2", "body_10"],
    });
  });

  it("de-duplicates a placeholder repeated in the body", () => {
    const components = [{ type: "BODY", text: "{{1}} and again {{1}}" }];
    expect(extractParameterSchema(components)).toEqual({ body: ["body_1"] });
  });

  it("captures variables from a text header alongside the body", () => {
    const components = [
      { type: "HEADER", format: "TEXT", text: "{{1}}" },
      { type: "BODY", text: "{{1}} {{2}}" },
    ];
    expect(extractParameterSchema(components)).toEqual({
      header: ["header_1"],
      body: ["body_1", "body_2"],
    });
  });

  it("ignores non-text headers, which take media rather than text parameters", () => {
    const components = [
      { type: "HEADER", format: "IMAGE" },
      { type: "BODY", text: "{{1}}" },
    ];
    expect(extractParameterSchema(components)).toEqual({ body: ["body_1"] });
  });

  it("tolerates an empty component list", () => {
    expect(extractParameterSchema([])).toBeNull();
  });
});

describe("component field extraction", () => {
  const components = [
    { type: "HEADER", format: "TEXT", text: "Header" },
    { type: "BODY", text: "Body text" },
    { type: "FOOTER", text: "Footer text" },
  ];

  it("reads body, footer and header type", () => {
    expect(extractBody(components)).toBe("Body text");
    expect(extractFooter(components)).toBe("Footer text");
    expect(extractHeaderType(components)).toBe("TEXT");
  });

  it("falls back safely when components are absent", () => {
    expect(extractBody([])).toBe("");
    expect(extractFooter([])).toBeNull();
    expect(extractHeaderType([])).toBeNull();
  });
});
