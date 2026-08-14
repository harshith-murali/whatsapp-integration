import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

/**
 * The container image runs as a non-root user, so an unwritable log directory
 * must not crash the process at import time. This previously threw EACCES and
 * prevented the API from booting at all.
 */

const originalCwd = process.cwd();
let tempDir: string;

beforeEach(() => {
  vi.resetModules();
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "logger-test-"));
});

afterEach(() => {
  process.chdir(originalCwd);
  fs.rmSync(tempDir, { recursive: true, force: true });
  delete process.env.LOG_TO_FILE;
  delete process.env.LOG_DIRECTORY;
});

describe("logger startup resilience", () => {
  it("imports successfully when the log directory cannot be created", async () => {
    // Simulate a read-only application directory.
    const readOnly = path.join(tempDir, "readonly");
    fs.mkdirSync(readOnly);
    fs.chmodSync(readOnly, 0o555);
    process.chdir(readOnly);

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { logger } = await import("./logger.js");

    expect(logger).toBeDefined();
    expect(() => logger.info("still logging")).not.toThrow();

    // Restore permissions so cleanup can remove the directory.
    fs.chmodSync(readOnly, 0o755);
    warn.mockRestore();
  });

  it("skips file logging entirely when LOG_TO_FILE is false", async () => {
    process.env.LOG_TO_FILE = "false";
    process.chdir(tempDir);

    const { logger } = await import("./logger.js");
    logger.info("console only");

    expect(fs.existsSync(path.join(tempDir, "logs"))).toBe(false);
  });

  it("creates the log directory when the filesystem is writable", async () => {
    process.chdir(tempDir);

    await import("./logger.js");

    expect(fs.existsSync(path.join(tempDir, "logs"))).toBe(true);
  });
});

describe("maskPhone", () => {
  it("masks the middle digits of a phone number", async () => {
    const { maskPhone } = await import("./logger.js");
    expect(maskPhone("919876543210")).toBe("91******3210");
  });

  it("leaves values that are not phone numbers untouched", async () => {
    const { maskPhone } = await import("./logger.js");
    expect(maskPhone("not-a-phone")).toBe("not-a-phone");
  });
});
