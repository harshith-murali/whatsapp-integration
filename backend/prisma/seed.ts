import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
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
  role: "SUPER_ADMIN" | "ADMIN" | "OPERATOR" | "VIEWER";
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

async function main() {
  console.log("--------------------------------------------------");
  console.log("[SEED] Upserting test admin accounts...");
  console.log("--------------------------------------------------");

  for (const admin of admins) {
    const passwordHash = await bcrypt.hash(admin.password, 12);

    await prisma.admin.upsert({
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

    console.log(`  ✓  [${admin.role.padEnd(11)}]  ${admin.email}  /  ${admin.password}`);
  }

  console.log("--------------------------------------------------");
  console.log("[SEED SUCCESS] All accounts created / updated.");
  console.log("--------------------------------------------------");
  console.log("");
  console.log("TEST CREDENTIALS");
  console.log("--------------------------------------------------");
  for (const admin of admins) {
    console.log(`  Role: ${admin.role}`);
    console.log(`  Email:    ${admin.email}`);
    console.log(`  Password: ${admin.password}`);
    console.log("  --");
  }
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
