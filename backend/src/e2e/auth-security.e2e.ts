import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import request from "supertest";
import type { Express } from "express";
import {
  loadApp,
  getPrisma,
  resetDatabase,
  createAdmin,
  login,
  authed,
} from "./harness.js";

/**
 * End-to-end coverage of authentication, CSRF and role-based authorization
 * against the real Express middleware stack.
 */

let app: Express;
let prisma: Awaited<ReturnType<typeof getPrisma>>;

const OPERATOR = { email: "op@e2e.test", password: "OperatorPass123!" };
const VIEWER = { email: "viewer@e2e.test", password: "ViewerPass123!" };
const ADMIN = { email: "admin2@e2e.test", password: "AdminPass123!" };

beforeAll(async () => {
  app = await loadApp();
  prisma = await getPrisma();
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await resetDatabase();
});

const draftPayload = {
  title: "Test",
  message: "hello",
  category: "ANNOUNCEMENT",
  severity: "LOW",
  audienceType: "ALL_ACTIVE_SUBSCRIBERS",
};

describe("E2E: authentication", () => {
  it("rejects unauthenticated access to protected routes", async () => {
    const response = await request(app).get("/api/broadcasts");
    expect(response.status).toBe(401);
  });

  it("rejects login with a wrong password", async () => {
    await createAdmin({ ...ADMIN, role: "ADMIN" });
    await expect(login(app, ADMIN.email, "WrongPassword123!")).rejects.toThrow(/401|E2E login failed/);
  });

  it("rejects login for an unknown email", async () => {
    await expect(login(app, "nobody@e2e.test", "Whatever123!")).rejects.toThrow();
  });

  it("does not reveal whether an email exists", async () => {
    await createAdmin({ ...ADMIN, role: "ADMIN" });

    const csrf = await request(app).get("/api/auth/csrf");
    const cookies = (csrf.headers["set-cookie"] as unknown as string[]).map(
      (c) => c.split(";")[0]!
    );

    const wrongPassword = await request(app)
      .post("/api/auth/login")
      .set("Cookie", cookies)
      .set("x-csrf-token", csrf.body.data.csrfToken)
      .send({ email: ADMIN.email, password: "WrongPassword123!" });

    const unknownEmail = await request(app)
      .post("/api/auth/login")
      .set("Cookie", cookies)
      .set("x-csrf-token", csrf.body.data.csrfToken)
      .send({ email: "ghost@e2e.test", password: "WrongPassword123!" });

    // Identical responses prevent account enumeration.
    expect(wrongPassword.status).toBe(unknownEmail.status);
    expect(wrongPassword.body.message).toBe(unknownEmail.body.message);
  });

  it("returns the current admin from /me after login", async () => {
    await createAdmin({ ...ADMIN, role: "ADMIN" });
    const admin = authed(await login(app, ADMIN.email, ADMIN.password));

    const me = await admin.get("/api/auth/me");
    expect(me.status).toBe(200);
    expect(me.body.data.email).toBe(ADMIN.email);
  });

  it("never returns the password hash", async () => {
    await createAdmin({ ...ADMIN, role: "ADMIN" });
    const admin = authed(await login(app, ADMIN.email, ADMIN.password));

    const me = await admin.get("/api/auth/me");
    expect(JSON.stringify(me.body)).not.toContain("passwordHash");
    expect(JSON.stringify(me.body)).not.toContain("$2");
  });

  it("blocks a deactivated admin from authenticating", async () => {
    const admin = await createAdmin({ ...ADMIN, role: "ADMIN" });

    // Confirm the same credentials work before deactivation, so the assertion
    // below cannot pass for an unrelated reason.
    await expect(login(app, ADMIN.email, ADMIN.password)).resolves.toBeDefined();

    await prisma.admin.update({ where: { id: admin.id }, data: { isActive: false } });
    await expect(login(app, ADMIN.email, ADMIN.password)).rejects.toThrow(/401/);
  });
});

describe("E2E: CSRF protection", () => {
  it("rejects a state-changing request that omits the CSRF token", async () => {
    await createAdmin({ ...ADMIN, role: "ADMIN" });
    const agent = await login(app, ADMIN.email, ADMIN.password);

    const response = await request(app)
      .post("/api/broadcasts")
      .set("Cookie", agent.cookies) // authenticated, but no x-csrf-token
      .send(draftPayload);

    expect(response.status).toBe(403);
  });

  it("rejects a mismatched CSRF token", async () => {
    await createAdmin({ ...ADMIN, role: "ADMIN" });
    const agent = await login(app, ADMIN.email, ADMIN.password);

    const response = await request(app)
      .post("/api/broadcasts")
      .set("Cookie", agent.cookies)
      .set("x-csrf-token", "forged-token-value")
      .send(draftPayload);

    expect(response.status).toBe(403);
  });
});

describe("E2E: role-based authorization", () => {
  it("prevents an OPERATOR from approving their own broadcast", async () => {
    await createAdmin({ ...OPERATOR, role: "OPERATOR" });
    const operator = authed(await login(app, OPERATOR.email, OPERATOR.password));

    const draft = await operator.post("/api/broadcasts").send(draftPayload);
    expect(draft.status).toBe(201);
    await operator.post(`/api/broadcasts/${draft.body.data.id}/submit`);

    // Separation of duties: the author must not be able to approve.
    const approve = await operator.post(`/api/broadcasts/${draft.body.data.id}/approve`);
    expect(approve.status).toBe(403);
  });

  it("prevents an OPERATOR from queueing a broadcast", async () => {
    await createAdmin({ ...OPERATOR, role: "OPERATOR" });
    await createAdmin({ ...ADMIN, role: "ADMIN" });

    const operator = authed(await login(app, OPERATOR.email, OPERATOR.password));
    const draft = await operator.post("/api/broadcasts").send(draftPayload);
    const id = draft.body.data.id;
    await operator.post(`/api/broadcasts/${id}/submit`);

    const admin = authed(await login(app, ADMIN.email, ADMIN.password));
    await admin.post(`/api/broadcasts/${id}/approve`);

    // Approved, but the operator still cannot trigger the send.
    const queue = await operator.post(`/api/broadcasts/${id}/queue`);
    expect(queue.status).toBe(403);
  });

  it("prevents a VIEWER from creating a broadcast", async () => {
    await createAdmin({ ...VIEWER, role: "VIEWER" });
    const viewer = authed(await login(app, VIEWER.email, VIEWER.password));

    const response = await viewer.post("/api/broadcasts").send(draftPayload);
    expect(response.status).toBe(403);
  });

  it("prevents a non-super-admin from managing admins", async () => {
    await createAdmin({ ...ADMIN, role: "ADMIN" });
    const admin = authed(await login(app, ADMIN.email, ADMIN.password));

    expect((await admin.get("/api/admins")).status).toBe(403);
  });

  it("allows a SUPER_ADMIN to manage admins", async () => {
    // Paired with the test above so a blanket-deny regression cannot pass.
    await createAdmin({
      email: "super@e2e.test",
      password: "SuperPass123!",
      role: "SUPER_ADMIN",
    });
    const superAdmin = authed(await login(app, "super@e2e.test", "SuperPass123!"));

    expect((await superAdmin.get("/api/admins")).status).toBe(200);
  });
});

describe("E2E: input validation at the HTTP boundary", () => {
  it("rejects a broadcast with an empty message", async () => {
    await createAdmin({ ...ADMIN, role: "ADMIN" });
    const admin = authed(await login(app, ADMIN.email, ADMIN.password));

    const response = await admin
      .post("/api/broadcasts")
      .send({ ...draftPayload, message: "   " });

    expect(response.status).toBe(400);
    expect(await prisma.broadcast.count()).toBe(0);
  });

  it("rejects a message over the 2000 character limit", async () => {
    await createAdmin({ ...ADMIN, role: "ADMIN" });
    const admin = authed(await login(app, ADMIN.email, ADMIN.password));

    const response = await admin
      .post("/api/broadcasts")
      .send({ ...draftPayload, message: "x".repeat(2001) });

    expect(response.status).toBe(400);
  });

  it("rejects a group id when the audience is everyone", async () => {
    await createAdmin({ ...ADMIN, role: "ADMIN" });
    const admin = authed(await login(app, ADMIN.email, ADMIN.password));

    const response = await admin.post("/api/broadcasts").send({
      ...draftPayload,
      audienceType: "ALL_ACTIVE_SUBSCRIBERS",
      groupId: 1,
    });

    expect(response.status).toBe(400);
  });

  it("returns 404 for an unknown broadcast", async () => {
    await createAdmin({ ...ADMIN, role: "ADMIN" });
    const admin = authed(await login(app, ADMIN.email, ADMIN.password));

    const response = await admin.get("/api/broadcasts/999999");
    expect(response.status).toBe(404);
  });
});
