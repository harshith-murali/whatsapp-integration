import { z } from "zod";
import { SubscriberStatus } from "../generated/prisma/client.js";

export const normalizePhone = (phone: string): string => {
  return phone.replace(/[\s+\-()]/g, "");
};

export const normalizeCountryCode = (countryCode: string): string => {
  const normalized = countryCode.trim().replace(/\s/g, "");
  return normalized.startsWith("+") ? normalized : `+${normalized}`;
};

export const buildFullPhoneNumber = (countryCode: string | undefined, phoneNumber: string): string => {
  const normalizedPhone = normalizePhone(phoneNumber);
  if (normalizedPhone.startsWith("+")) {
    return normalizePhone(normalizedPhone);
  }

  if (!countryCode) {
    return normalizedPhone;
  }

  return `${normalizeCountryCode(countryCode).replace("+", "")}${normalizedPhone.replace(/^0+/, "")}`;
};

export const countryCodeSchema = z
  .string()
  .trim()
  .transform((val) => normalizeCountryCode(val))
  .refine((val) => /^\+[1-9]\d{0,3}$/.test(val), {
    message: "Country code must be a valid dialing code, for example +91",
  });

export const phoneSchema = z
  .string()
  .min(1, "Phone number is required")
  .transform((val) => normalizePhone(val))
  .refine((val) => /^\d{7,15}$/.test(val), {
    message: "Phone number must be between 7 and 15 digits, digits only after normalization",
  });

const subscriberObjectSchema = z.object({
  name: z.string().trim().max(100).optional().nullable(),
  countryCode: countryCodeSchema.optional(),
  phoneNumber: phoneSchema,
  status: z.nativeEnum(SubscriberStatus).default(SubscriberStatus.ACTIVE),
  optedIn: z.boolean().default(true),
});

export const createSubscriberSchema = subscriberObjectSchema.transform((data) => ({
  ...data,
  phoneNumber: buildFullPhoneNumber(data.countryCode, data.phoneNumber),
}));

export const updateSubscriberSchema = subscriberObjectSchema.partial().transform((data) => ({
  ...data,
  phoneNumber: data.phoneNumber ? buildFullPhoneNumber(data.countryCode, data.phoneNumber) : undefined,
}));
