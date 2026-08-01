import { z } from "zod";
import { AdminRole } from "../generated/prisma/client.js";
import { passwordSchema } from "./admin.js";
import { normalizeEmail, normalizePhoneNumber, sanitizeText } from "../utils/normalization.js";

const requestedRoleSchema = z
  .enum([AdminRole.ADMIN, AdminRole.OPERATOR, AdminRole.VIEWER])
  .optional();

export const publicAccessRequestSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(60),
  lastName: z.string().trim().min(1, "Last name is required").max(60),
  email: z.string().email("Invalid email address").transform(normalizeEmail),
  phoneNumber: z
    .string()
    .min(1, "Phone number is required")
    .transform(normalizePhoneNumber)
    .refine((value) => value.length >= 7 && value.length <= 15, {
      message: "Phone number must be a valid international number",
    }),
  company: z.string().max(120).optional().transform((value) => sanitizeText(value, 120)),
  department: z.string().max(120).optional().transform((value) => sanitizeText(value, 120)),
  reason: z.string().max(1000).optional().transform((value) => sanitizeText(value, 1000)),
  requestedRole: requestedRoleSchema,
  website: z.string().max(0).optional(),
  formStartedAt: z.number().optional(),
});

export const accessRequestListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(120).optional(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "WITHDRAWN"]).optional(),
  requestedRole: requestedRoleSchema,
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  sortBy: z.enum(["createdAt", "updatedAt", "reviewedAt", "email", "status"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const approveAccessRequestSchema = z.object({
  role: z.enum([AdminRole.ADMIN, AdminRole.OPERATOR, AdminRole.VIEWER]),
  temporaryPassword: passwordSchema.optional(),
  sendInvitation: z.boolean().optional().default(false),
  notes: z.string().max(1000).optional().transform((value) => sanitizeText(value, 1000)),
});

export const rejectAccessRequestSchema = z.object({
  reason: z.string().trim().min(1, "Rejection reason is required").max(1000),
});
