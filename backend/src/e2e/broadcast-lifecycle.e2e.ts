import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import type { Express } from "express";
import {
  loadApp,
  getPrisma,
  resetDatabase,
  createAdmin,
  login,
  authed,
  stubMetaApi,
} from "./harness.js";

/**
 * End-to-end coverage of the broadcast lifecycle over real HTTP against a real
 * MySQL. Only the Meta HTTP call is stubbed, so no WhatsApp message is ever
 * actually sent.
 *
 * Flow: login -> create draft -> submit -> approve -> queue -> worker send.
 */

let app: Express;
let prisma: Awaited<ReturnType<typeof getPrisma>>;

const OPERATOR = { email: "operator@e2e.test", password: "OperatorPass123!" };
const ADMIN = { email: "admin@e2e.test", password: "AdminPass123!" };

const APPROVED_TEMPLATE = {
  metaTemplateId: "tpl-e2e-1",
  name: "broadcast_alert",
  language: "en",
  category: "MARKETING",
  status: "APPROVED" as const,
  body: "Notice from Pranasya Technologies\n{{1}} \nThank You.",
  components: [
    { type: "BODY", text: "Notice from Pranasya Technologies\n{{1}} \nThank You." },
  ],
  parameterSchema: { body: ["body_1"] },
};

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

const seedSubscribers = async (count: number, opts: { optedIn?: boolean } = {}) => {
  const created = [];
  for (let i = 0; i < count; i++) {
    created.push(
      await prisma.subscriber.create({
        data: {
          name: `Subscriber ${i}`,
          phoneNumber: `9198765432${String(i).padStart(2, "0")}`,
          status: "ACTIVE",
          optedIn: opts.optedIn ?? true,
        },
      })
    );
  }
  return created;
};

const seedTemplate = () => prisma.messageTemplate.create({ data: APPROVED_TEMPLATE });

describe("E2E: broadcast lifecycle", () => {
  it("carries a custom message from HTTP request through to the Meta payload", async () => {
    await seedTemplate();
    const subscribers = await seedSubscribers(3);
    await createAdmin({ ...OPERATOR, role: "OPERATOR" });
    await createAdmin({ ...ADMIN, role: "ADMIN" });

    // 1. Operator drafts a broadcast with custom text.
    const operator = authed(await login(app, OPERATOR.email, OPERATOR.password));
    const draft = await operator.post("/api/broadcasts").send({
      title: "Team sync",
      message: "meeting in an hr",
      category: "ANNOUNCEMENT",
      severity: "LOW",
      audienceType: "ALL_ACTIVE_SUBSCRIBERS",
    });
    expect(draft.status).toBe(201);
    const broadcastId = draft.body.data.id;
    expect(draft.body.data.message).toBe("meeting in an hr");

    // 2. Operator submits for approval.
    const submitted = await operator.post(`/api/broadcasts/${broadcastId}/submit`);
    expect(submitted.status).toBe(200);
    expect(submitted.body.data.status).toBe("PENDING_APPROVAL");

    // 3. Admin approves and queues.
    const admin = authed(await login(app, ADMIN.email, ADMIN.password));
    const approved = await admin.post(`/api/broadcasts/${broadcastId}/approve`);
    expect(approved.status).toBe(200);
    expect(approved.body.data.status).toBe("APPROVED");

    const queued = await admin.post(`/api/broadcasts/${broadcastId}/queue`);
    expect(queued.status).toBe(200);
    expect(queued.body.data.status).toBe("QUEUED");
    expect(queued.body.data.totalRecipients).toBe(subscribers.length);

    // One QUEUED message row per eligible recipient.
    const messages = await prisma.message.findMany({ where: { broadcastId } });
    expect(messages).toHaveLength(subscribers.length);
    expect(messages.every((message) => message.status === "QUEUED")).toBe(true);

    // 4. Send through the real provider with the Meta HTTP boundary stubbed.
    const meta = stubMetaApi();
    try {
      const { MetaWhatsAppProvider } = await import("../providers/meta-whatsapp.provider.js");
      const provider = new MetaWhatsAppProvider();
      const broadcast = await prisma.broadcast.findUniqueOrThrow({
        where: { id: broadcastId },
      });

      for (const message of messages) {
        await provider.send({
          messageId: message.id,
          broadcastId,
          subscriberId: message.subscriberId,
          phoneNumber: message.phoneNumber,
          message: broadcast.message,
          lastInboundMessageAt: null,
          metadata: {
            templateSnapshot: broadcast.templateSnapshot,
            templateName: broadcast.templateName,
            templateLanguage: broadcast.templateLanguage,
            templateVariables: broadcast.templateVariables,
          },
        });
      }

      expect(meta.calls).toHaveLength(subscribers.length);

      // The assertion this whole exercise exists for: the operator's text
      // reaches Meta, not the template's fixed sample copy.
      for (const call of meta.calls) {
        expect(call.body.type).toBe("template");
        expect(call.body.template.name).toBe("broadcast_alert");
        expect(call.body.template.components[0].parameters[0].text).toBe("meeting in an hr");
      }
    } finally {
      meta.restore();
    }
  });

  it("sends free-form text to a recipient inside the customer-service window", async () => {
    await seedTemplate();
    const subscriber = await prisma.subscriber.create({
      data: {
        name: "Recent",
        phoneNumber: "919000000001",
        status: "ACTIVE",
        optedIn: true,
        lastInboundMessageAt: new Date(),
      },
    });

    const meta = stubMetaApi();
    try {
      const { MetaWhatsAppProvider } = await import("../providers/meta-whatsapp.provider.js");
      await new MetaWhatsAppProvider().send({
        messageId: 1,
        broadcastId: 1,
        subscriberId: subscriber.id,
        phoneNumber: subscriber.phoneNumber,
        message: "meeting in an hr",
        lastInboundMessageAt: subscriber.lastInboundMessageAt,
        metadata: {},
      });

      expect(meta.calls[0].body.type).toBe("text");
      expect(meta.calls[0].body.text.body).toBe("meeting in an hr");
    } finally {
      meta.restore();
    }
  });

  it("excludes opted-out and unsubscribed recipients when queueing", async () => {
    await seedTemplate();
    await seedSubscribers(2); // eligible
    await prisma.subscriber.create({
      data: { name: "Opted out", phoneNumber: "919111111101", status: "ACTIVE", optedIn: false },
    });
    await prisma.subscriber.create({
      data: {
        name: "Unsubscribed",
        phoneNumber: "919111111102",
        status: "UNSUBSCRIBED",
        optedIn: true,
      },
    });

    await createAdmin({ ...ADMIN, role: "ADMIN" });
    const admin = authed(await login(app, ADMIN.email, ADMIN.password));

    const draft = await admin.post("/api/broadcasts").send({
      title: "Filtered",
      message: "only eligible people",
      category: "ANNOUNCEMENT",
      severity: "LOW",
      audienceType: "ALL_ACTIVE_SUBSCRIBERS",
    });
    const id = draft.body.data.id;
    await admin.post(`/api/broadcasts/${id}/submit`);
    await admin.post(`/api/broadcasts/${id}/approve`);
    const queued = await admin.post(`/api/broadcasts/${id}/queue`);

    expect(queued.status).toBe(200);
    expect(queued.body.data.totalRecipients).toBe(2);
  });

  it("refuses to queue a broadcast that has not been approved", async () => {
    await seedTemplate();
    await seedSubscribers(1);
    await createAdmin({ ...ADMIN, role: "ADMIN" });
    const admin = authed(await login(app, ADMIN.email, ADMIN.password));

    const draft = await admin.post("/api/broadcasts").send({
      title: "Premature",
      message: "should not send",
      category: "ANNOUNCEMENT",
      severity: "LOW",
      audienceType: "ALL_ACTIVE_SUBSCRIBERS",
    });

    const queued = await admin.post(`/api/broadcasts/${draft.body.data.id}/queue`);

    expect(queued.status).toBe(409);
    expect(await prisma.message.count()).toBe(0);
  });

  it("cancels queued messages so they are never delivered", async () => {
    await seedTemplate();
    await seedSubscribers(3);
    await createAdmin({ ...ADMIN, role: "ADMIN" });
    const admin = authed(await login(app, ADMIN.email, ADMIN.password));

    const draft = await admin.post("/api/broadcasts").send({
      title: "Cancel me",
      message: "recalled announcement",
      category: "ANNOUNCEMENT",
      severity: "LOW",
      audienceType: "ALL_ACTIVE_SUBSCRIBERS",
    });
    const id = draft.body.data.id;
    await admin.post(`/api/broadcasts/${id}/submit`);
    await admin.post(`/api/broadcasts/${id}/approve`);
    await admin.post(`/api/broadcasts/${id}/queue`);

    const cancelled = await admin
      .post(`/api/broadcasts/${id}/cancel`)
      .send({ reason: "Sent in error" });

    expect(cancelled.status).toBe(200);
    expect(cancelled.body.data.status).toBe("CANCELLED");

    const remaining = await prisma.message.findMany({ where: { broadcastId: id } });
    expect(remaining.every((message) => message.status === "CANCELLED")).toBe(true);
  });

  it("rejects a broadcast with no eligible recipients rather than queueing an empty send", async () => {
    await seedTemplate();
    await createAdmin({ ...ADMIN, role: "ADMIN" });
    const admin = authed(await login(app, ADMIN.email, ADMIN.password));

    const draft = await admin.post("/api/broadcasts").send({
      title: "Nobody",
      message: "into the void",
      category: "ANNOUNCEMENT",
      severity: "LOW",
      audienceType: "ALL_ACTIVE_SUBSCRIBERS",
    });
    const id = draft.body.data.id;
    await admin.post(`/api/broadcasts/${id}/submit`);
    await admin.post(`/api/broadcasts/${id}/approve`);

    const queued = await admin.post(`/api/broadcasts/${id}/queue`);
    expect(queued.status).toBe(422);
  });

  it("deduplicates recipients that share a phone number", async () => {
    await seedTemplate();
    await prisma.subscriber.create({
      data: { name: "A", phoneNumber: "919222222201", status: "ACTIVE", optedIn: true },
    });
    await prisma.subscriber.create({
      data: { name: "B", phoneNumber: "+91 92222 22201", status: "ACTIVE", optedIn: true },
    });

    await createAdmin({ ...ADMIN, role: "ADMIN" });
    const admin = authed(await login(app, ADMIN.email, ADMIN.password));

    const draft = await admin.post("/api/broadcasts").send({
      title: "Dedupe",
      message: "only once please",
      category: "ANNOUNCEMENT",
      severity: "LOW",
      audienceType: "ALL_ACTIVE_SUBSCRIBERS",
    });
    const id = draft.body.data.id;
    await admin.post(`/api/broadcasts/${id}/submit`);
    await admin.post(`/api/broadcasts/${id}/approve`);
    const queued = await admin.post(`/api/broadcasts/${id}/queue`);

    // The same human must not receive the broadcast twice.
    expect(queued.body.data.totalRecipients).toBe(1);
  });
});
