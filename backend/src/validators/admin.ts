import { z } from "zod";
import { AdminRole } from "../generated/prisma/client.js";

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters long")
  .refine((val) => /[A-Z]/.test(val), { message: "Password must contain at least one uppercase letter" })
  .refine((val) => /[a-z]/.test(val), { message: "Password must contain at least one lowercase letter" })
  .refine((val) => /\d/.test(val), { message: "Password must contain at least one number" })
  .refine((val) => /[^A-Za-z0-9]/.test(val), { message: "Password must contain at least one special character" });

export const createAdminSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email address"),
  password: passwordSchema,
  role: z.nativeEnum(AdminRole).default(AdminRole.VIEWER),
  isActive: z.boolean().default(true),
});

export const updateAdminSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100).optional(),
  email: z.string().email("Invalid email address").optional(),
  password: passwordSchema.optional().or(z.literal("")),
  role: z.nativeEnum(AdminRole).optional(),
  isActive: z.boolean().optional(),
});

export const updateAdminStatusSchema = z.object({
  isActive: z.boolean(),
});
