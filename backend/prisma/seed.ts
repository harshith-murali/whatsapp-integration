import "dotenv/config";
import { PrismaClient, AdminRole, SubscriberStatus, BroadcastCategory, BroadcastSeverity, BroadcastAudienceType, BroadcastStatus } from "../src/generated/prisma/client.js";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import bcrypt from "bcryptjs";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const adapter = new PrismaMariaDb(databaseUrl);
const prisma = new PrismaClient({ adapter });

interface SeedAdmin {
  name: string;
  email: string;
  password: string;
  role: AdminRole;
}

const admins: SeedAdmin[] = [
  {
    name: "Super Admin",
    email: "superadmin@alerts.com",
    password: "SuperAdmin@123",
    role: "SUPER_ADMIN",
  },
  {
    name: "Admin User",
    email: "admin@alerts.com",
    password: "Admin@123",
    role: "ADMIN",
  },
  {
    name: "Operator User",
    email: "operator@alerts.com",
    password: "Operator@123",
    role: "OPERATOR",
  },
  {
    name: "Viewer User",
    email: "viewer@alerts.com",
    password: "Viewer@123",
    role: "VIEWER",
  },
];

const mockSubscribers = [
  { name: "Aarav Sharma", phoneNumber: "919876543210", status: SubscriberStatus.ACTIVE, optedIn: true },
  { name: "Aditi Patel", phoneNumber: "919812345678", status: SubscriberStatus.ACTIVE, optedIn: true },
  { name: "Rohan Das", phoneNumber: "919123456789", status: SubscriberStatus.ACTIVE, optedIn: true },
  { name: "Neha Sen", phoneNumber: "919555123456", status: SubscriberStatus.ACTIVE, optedIn: false }, // Opted out
  { name: "John Doe", phoneNumber: "14155550199", status: SubscriberStatus.UNSUBSCRIBED, optedIn: true }, // Unsubscribed
  { name: "Jane Smith", phoneNumber: "12125550144", status: SubscriberStatus.BLOCKED, optedIn: true }, // Blocked
  { name: "Kabir Mehta", phoneNumber: "919998887776", status: SubscriberStatus.ACTIVE, optedIn: true },
  { name: "Ananya Iyer", phoneNumber: "919666555444", status: SubscriberStatus.ACTIVE, optedIn: true },
  { name: "Vikram Malhotra", phoneNumber: "919222333444", status: SubscriberStatus.ACTIVE, optedIn: true },
  { name: "Priya Rao", phoneNumber: "919111222333", status: SubscriberStatus.ACTIVE, optedIn: true },
];

async function main() {
  console.log("--------------------------------------------------");
  console.log("[SEED] Upserting test admin accounts...");
  console.log("--------------------------------------------------");

  const adminMap: Record<string, number> = {};

  for (const admin of admins) {
    const passwordHash = await bcrypt.hash(admin.password, 12);

    const record = await prisma.admin.upsert({
      where: { email: admin.email },
      update: {
        name: admin.name,
        passwordHash,
        role: admin.role,
        isActive: true,
      },
      create: {
        name: admin.name,
        email: admin.email,
        passwordHash,
        role: admin.role,
        isActive: true,
      },
    });

    adminMap[admin.role] = record.id;
    console.log(`  ✓  [${admin.role.padEnd(11)}]  ${admin.email}  /  ${admin.password}`);
  }

  console.log("--------------------------------------------------");
  console.log("[SEED] Seeding subscriber records...");
  console.log("--------------------------------------------------");

  const subscriberMap: Record<string, number> = {};

  for (const sub of mockSubscribers) {
    const record = await prisma.subscriber.upsert({
      where: { phoneNumber: sub.phoneNumber },
      update: {
        name: sub.name,
        status: sub.status,
        optedIn: sub.optedIn,
      },
      create: {
        name: sub.name,
        phoneNumber: sub.phoneNumber,
        status: sub.status,
        optedIn: sub.optedIn,
      },
    });
    subscriberMap[sub.phoneNumber] = record.id;
  }
  console.log(`  ✓  Seeded ${mockSubscribers.length} subscribers.`);

  console.log("--------------------------------------------------");
  console.log("[SEED] Seeding recipient groups...");
  console.log("--------------------------------------------------");

  const superAdminId = adminMap["SUPER_ADMIN"];
  const operatorId = adminMap["OPERATOR"];

  // 1. Group: Internal Employees
  const group1 = await prisma.subscriberGroup.upsert({
    where: { name: "Internal Employees" },
    update: {},
    create: {
      name: "Internal Employees",
      description: "Company internal staff alerts directory list",
      createdById: superAdminId,
    },
  });

  // 2. Group: Alpha Testers
  const group2 = await prisma.subscriberGroup.upsert({
    where: { name: "Alpha Testers" },
    update: {},
    create: {
      name: "Alpha Testers",
      description: "Subscribers opted in for experimental features list alerts",
      createdById: superAdminId,
    },
  });

  console.log(`  ✓  Seeded groups: "${group1.name}", "${group2.name}".`);

  // Clear existing membership entries to prevent unique violations
  await prisma.subscriberGroupMember.deleteMany({
    where: {
      groupId: { in: [group1.id, group2.id] },
    },
  });

  // Assign members to Group 1 (Internal Employees)
  const group1Phones = ["919876543210", "919812345678", "919123456789", "919555123456", "14155550199"];
  for (const phone of group1Phones) {
    const subscriberId = subscriberMap[phone];
    if (subscriberId) {
      await prisma.subscriberGroupMember.create({
        data: {
          groupId: group1.id,
          subscriberId,
          addedById: superAdminId,
        },
      });
    }
  }

  // Assign members to Group 2 (Alpha Testers)
  const group2Phones = ["919998887776", "919666555444", "919222333444", "919111222333", "12125550144"];
  for (const phone of group2Phones) {
    const subscriberId = subscriberMap[phone];
    if (subscriberId) {
      await prisma.subscriberGroupMember.create({
        data: {
          groupId: group2.id,
          subscriberId,
          addedById: superAdminId,
        },
      });
    }
  }
  console.log("  ✓  Mapped group memberships.");

  console.log("--------------------------------------------------");
  console.log("[SEED] Seeding broadcast workflows...");
  console.log("--------------------------------------------------");

  // Delete previously seeded test broadcasts to reset state cleanly
  await prisma.broadcast.deleteMany({
    where: {
      title: {
        in: [
          "Emergency Server Downtime Maintenance Alert",
          "Alpha Broadcast Test 1",
          "System Security Upgrade Instructions",
          "Monthly Performance Newsletter",
        ],
      },
    },
  });

  // 1. DRAFT (Created by Operator)
  const b1 = await prisma.broadcast.create({
    data: {
      title: "Emergency Server Downtime Maintenance Alert",
      message: "Important: We are performing emergency system updates. All API services will be offline for 30 minutes starting at 12:00 AM UTC.",
      category: BroadcastCategory.EMERGENCY,
      severity: BroadcastSeverity.CRITICAL,
      audienceType: BroadcastAudienceType.ALL_ACTIVE_SUBSCRIBERS,
      status: BroadcastStatus.DRAFT,
      createdById: operatorId,
      totalRecipients: 0,
    },
  });

  // 2. PENDING_APPROVAL (Created by Operator)
  const b2 = await prisma.broadcast.create({
    data: {
      title: "Alpha Broadcast Test 1",
      message: "Hello Beta Tester! This is a test broadcast to verify internal recipient deduplication features. Please disregard.",
      category: BroadcastCategory.ANNOUNCEMENT,
      severity: BroadcastSeverity.LOW,
      audienceType: BroadcastAudienceType.GROUP,
      groupId: group2.id,
      status: BroadcastStatus.PENDING_APPROVAL,
      createdById: operatorId,
      submittedAt: new Date(),
      totalRecipients: 0,
    },
  });

  // 3. APPROVED (Created by Operator, Approved by Super Admin)
  const b3 = await prisma.broadcast.create({
    data: {
      title: "System Security Upgrade Instructions",
      message: "Notice: Please ensure you rotate your session keys before Friday to comply with the new security regulations.",
      category: BroadcastCategory.SERVICE_UPDATE,
      severity: BroadcastSeverity.HIGH,
      audienceType: BroadcastAudienceType.GROUP,
      groupId: group1.id,
      status: BroadcastStatus.APPROVED,
      createdById: operatorId,
      submittedAt: new Date(),
      approvedById: superAdminId,
      approvedAt: new Date(),
      totalRecipients: 0,
    },
  });

  console.log("  ✓  Created DRAFT, PENDING_APPROVAL and APPROVED seed broadcasts.");
  console.log("--------------------------------------------------");
  console.log("[SEED SUCCESS] Seed data populated successfully!");
  console.log("--------------------------------------------------");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
