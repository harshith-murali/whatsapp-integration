import { describe, it, expect } from "vitest";
import { createBroadcastSchema, updateBroadcastSchema } from "./broadcast.js";

const valid = {
  title: "Maintenance",
  message: "meeting in an hr",
  category: "ANNOUNCEMENT",
  severity: "LOW",
  audienceType: "ALL_ACTIVE_SUBSCRIBERS",
};

describe("createBroadcastSchema", () => {
  it("accepts a valid broadcast and trims surrounding whitespace", () => {
    const parsed = createBroadcastSchema.parse({
      ...valid,
      title: "  Maintenance  ",
      message: "  meeting in an hr  ",
    });
    expect(parsed.title).toBe("Maintenance");
    expect(parsed.message).toBe("meeting in an hr");
  });

  it("rejects an empty message so an empty broadcast can never be queued", () => {
    expect(() => createBroadcastSchema.parse({ ...valid, message: "   " })).toThrow();
  });

  it("rejects a message beyond the 2000 character limit", () => {
    expect(() => createBroadcastSchema.parse({ ...valid, message: "x".repeat(2001) })).toThrow();
  });

  it("accepts a message exactly at the limit", () => {
    expect(() =>
      createBroadcastSchema.parse({ ...valid, message: "x".repeat(2000) })
    ).not.toThrow();
  });

  it("rejects a title beyond 100 characters", () => {
    expect(() => createBroadcastSchema.parse({ ...valid, title: "x".repeat(101) })).toThrow();
  });

  it("requires a group when the audience is GROUP", () => {
    expect(() =>
      createBroadcastSchema.parse({ ...valid, audienceType: "GROUP" })
    ).toThrow(/Group selection is required/);
  });

  it("accepts a GROUP audience with a group id", () => {
    expect(() =>
      createBroadcastSchema.parse({ ...valid, audienceType: "GROUP", groupId: 3 })
    ).not.toThrow();
  });

  it("rejects a group id when the audience is everyone", () => {
    // Guards against a broadcast that looks targeted but silently goes to all.
    expect(() =>
      createBroadcastSchema.parse({
        ...valid,
        audienceType: "ALL_ACTIVE_SUBSCRIBERS",
        groupId: 3,
      })
    ).toThrow();
  });

  it("rejects an unknown category", () => {
    expect(() => createBroadcastSchema.parse({ ...valid, category: "NOPE" })).toThrow();
  });

  it("accepts optional template variables", () => {
    const parsed = createBroadcastSchema.parse({
      ...valid,
      templateVariables: { body_1: "meeting in an hr" },
    });
    expect(parsed.templateVariables).toEqual({ body_1: "meeting in an hr" });
  });
});

describe("updateBroadcastSchema", () => {
  it("allows partial updates", () => {
    expect(() => updateBroadcastSchema.parse({ message: "changed" })).not.toThrow();
  });

  it("still enforces the message limit on update", () => {
    expect(() => updateBroadcastSchema.parse({ message: "x".repeat(2001) })).toThrow();
  });
});
