import crypto from "crypto";
import bcrypt from "bcryptjs";
import { AdminRole, Prisma } from "../generated/prisma/client.js";
import { ConflictError } from "../utils/errors.js";
import { normalizeEmail } from "../utils/normalization.js";

type PrismaClientLike = Prisma.TransactionClient;

export interface CreateAdminAccountInput {
  name: string;
  email: string;
  password: string;
  role: AdminRole;
  isActive?: boolean;
}

const adminSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.AdminSelect;

export const createAdminAccount = async (
  prismaClient: PrismaClientLike,
  input: CreateAdminAccountInput
) => {
  const email = normalizeEmail(input.email);
  const existing = await prismaClient.admin.findUnique({
    where: { email },
  });

  if (existing) {
    throw new ConflictError("An admin with this email already exists");
  }

  const passwordHash = await bcrypt.hash(input.password, 12);

  return prismaClient.admin.create({
    data: {
      name: input.name.trim(),
      email,
      passwordHash,
      role: input.role,
      isActive: input.isActive ?? true,
    },
    select: adminSelect,
  });
};

export const createTemporaryPassword = (): string => {
  return `Temp#${crypto.randomBytes(12).toString("base64url")}Aa1!`;
};
