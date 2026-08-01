import { z } from "zod";
import { SubscriberStatus } from "../generated/prisma/client.js";

export const normalizePhone = (phone: string): string => {
  return phone.replace(/[\s+\-()]/g, "");
};

export const phoneSchema = z
  .string()
  .min(1, "Phone number is required")
  .transform((val) => normalizePhone(val))
  .refine((val) => /^\d{7,15}$/.test(val), {
    message: "Phone number must be between 7 and 15 digits, digits only after normalization",
  });

export const createSubscriberSchema = z.object({
  name: z.string().trim().max(100).optional().nullable(),
  phoneNumber: phoneSchema,
  status: z.nativeEnum(SubscriberStatus).default(SubscriberStatus.ACTIVE),
  optedIn: z.boolean().default(true),
});

export const updateSubscriberSchema = createSubscriberSchema.partial();
