import { describe, it, expect } from "vitest";
import {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  UnprocessableEntityError,
  InternalServerError,
} from "./errors.js";

describe("AppError hierarchy", () => {
  it("maps each error type to its HTTP status", () => {
    expect(new BadRequestError().statusCode).toBe(400);
    expect(new UnauthorizedError().statusCode).toBe(401);
    expect(new ForbiddenError().statusCode).toBe(403);
    expect(new NotFoundError().statusCode).toBe(404);
    expect(new ConflictError().statusCode).toBe(409);
    expect(new UnprocessableEntityError().statusCode).toBe(422);
    expect(new InternalServerError().statusCode).toBe(500);
  });

  it("keeps instanceof working across the chain", () => {
    // The error middleware branches on `instanceof AppError`, so a broken
    // prototype chain would turn handled errors into 500s.
    const error = new NotFoundError("Broadcast not found");
    expect(error).toBeInstanceOf(NotFoundError);
    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(Error);
  });

  it("carries a custom message and falls back to a default", () => {
    expect(new ConflictError("Only APPROVED broadcasts can be queued").message).toBe(
      "Only APPROVED broadcasts can be queued"
    );
    expect(new NotFoundError().message).toBe("Not Found");
  });

  it("preserves validation detail passed alongside the message", () => {
    const details = [{ path: "message", issue: "required" }];
    expect(new BadRequestError("Invalid", details).errors).toEqual(details);
  });

  it("captures a stack trace", () => {
    expect(new AppError("boom", 500).stack).toBeDefined();
  });
});
