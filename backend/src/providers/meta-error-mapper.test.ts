import { describe, it, expect } from "vitest";
import { mapMetaError } from "./meta-error-mapper.js";

describe("mapMetaError", () => {
  it("classifies an expired access token as permanent so retries are not wasted", () => {
    // The real failure seen in this project: the token expired and every send
    // returned 401. Retrying cannot fix a dead credential.
    const error = mapMetaError({
      status: 401,
      responseBody: { error: { message: "Session has expired", code: 190 } },
    });

    expect(error.code).toBe("META_AUTH_OR_PERMISSION_ERROR");
    expect(error.retryable).toBe(false);
    expect(error.providerCode).toBe("190");
  });

  it("treats rate limiting as retryable", () => {
    const error = mapMetaError({ status: 429, responseBody: { error: { message: "Too many" } } });
    expect(error.code).toBe("META_RATE_LIMIT");
    expect(error.retryable).toBe(true);
  });

  it("treats Meta server errors as retryable", () => {
    const error = mapMetaError({ status: 503, responseBody: {} });
    expect(error.code).toBe("META_TRANSIENT_ERROR");
    expect(error.retryable).toBe(true);
  });

  it("treats a network failure with no HTTP status as retryable", () => {
    const error = mapMetaError({ cause: new Error("Meta request timed out") });
    expect(error.code).toBe("META_NETWORK_ERROR");
    expect(error.retryable).toBe(true);
  });

  it("classifies template faults as permanent", () => {
    const error = mapMetaError({
      status: 400,
      responseBody: { error: { message: "Template name does not exist" } },
    });
    expect(error.code).toBe("META_TEMPLATE_ERROR");
    expect(error.retryable).toBe(false);
  });

  it("classifies recipient faults as permanent", () => {
    const error = mapMetaError({
      status: 400,
      responseBody: { error: { message: "Invalid phone number" } },
    });
    expect(error.code).toBe("META_RECIPIENT_ERROR");
    expect(error.retryable).toBe(false);
  });

  it("redacts bearer tokens so credentials never reach the logs", () => {
    const error = mapMetaError({
      status: 400,
      responseBody: { error: { message: "Failed with Bearer EAAGm0PX4ZCpsBA1234secret" } },
    });

    expect(error.message).toContain("[REDACTED]");
    expect(error.message).not.toContain("EAAGm0PX4ZCpsBA1234secret");
  });

  it("caps message length to keep oversized provider payloads out of the database", () => {
    const error = mapMetaError({
      status: 400,
      responseBody: { error: { message: "x".repeat(2000) } },
    });
    expect(error.message.length).toBeLessThanOrEqual(500);
  });
});
