import { describe, it, expect } from "vitest";
import {
  normalizeEmail,
  normalizePhoneNumber,
  maskEmail,
  sanitizeText,
} from "./normalization.js";

describe("normalizeEmail", () => {
  it("lowercases and trims so duplicate accounts cannot be created by casing", () => {
    expect(normalizeEmail("  User@Example.COM  ")).toBe("user@example.com");
  });
});

describe("normalizePhoneNumber", () => {
  it("strips formatting to digits", () => {
    expect(normalizePhoneNumber("+91 98765-43210")).toBe("919876543210");
  });

  it("strips a leading plus and parentheses", () => {
    expect(normalizePhoneNumber("+1 (555) 010-2020")).toBe("15550102020");
  });

  it("rejects numbers that are too short", () => {
    expect(normalizePhoneNumber("12345")).toBe("");
  });

  it("rejects numbers that are too long", () => {
    expect(normalizePhoneNumber("1".repeat(16))).toBe("");
  });

  it("accepts the boundary lengths", () => {
    expect(normalizePhoneNumber("1".repeat(7))).toBe("1".repeat(7));
    expect(normalizePhoneNumber("1".repeat(15))).toBe("1".repeat(15));
  });

  it("returns empty for input with no digits", () => {
    expect(normalizePhoneNumber("not-a-number")).toBe("");
  });
});

describe("maskEmail", () => {
  it("keeps only the first two characters of the local part", () => {
    expect(maskEmail("harshith@example.com")).toBe("ha******@example.com");
  });

  it("still masks very short local parts", () => {
    expect(maskEmail("a@example.com")).toBe("a**@example.com");
  });

  it("flags malformed addresses rather than leaking them", () => {
    expect(maskEmail("not-an-email")).toBe("[invalid-email]");
  });
});

describe("sanitizeText", () => {
  it("collapses whitespace runs", () => {
    expect(sanitizeText("hello    world", 100)).toBe("hello world");
  });

  it("strips control characters that would corrupt logs or payloads", () => {
    // Built with fromCharCode so this source file stays plain ASCII while still
    // exercising the control-character branch of the sanitizer.
    const NUL = String.fromCharCode(0);
    const TAB = String.fromCharCode(9);
    const LF = String.fromCharCode(10);
    const DEL = String.fromCharCode(127);

    expect(sanitizeText(`line${LF}break`, 100)).toBe("line break");
    expect(sanitizeText(`tab${TAB}sep`, 100)).toBe("tab sep");
    expect(sanitizeText(`del${DEL}char`, 100)).toBe("del char");
    expect(sanitizeText(`nul${NUL}byte`, 100)).toBe("nul byte");
  });

  it("truncates to the maximum length", () => {
    expect(sanitizeText("x".repeat(50), 10)).toBe("x".repeat(10));
  });

  it("returns undefined for empty or whitespace-only input", () => {
    expect(sanitizeText("   ", 10)).toBeUndefined();
    expect(sanitizeText(undefined, 10)).toBeUndefined();
    expect(sanitizeText(null, 10)).toBeUndefined();
  });
});
