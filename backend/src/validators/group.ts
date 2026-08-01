import { z } from "zod";

export const createGroupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Group name is required")
    .max(100, "Group name cannot exceed 100 characters"),
  description: z
    .string()
    .trim()
    .max(500, "Description cannot exceed 500 characters")
    .optional()
    .nullable(),
});

export const updateGroupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Group name cannot be empty")
    .max(100, "Group name cannot exceed 100 characters")
    .optional(),
  description: z
    .string()
    .trim()
    .max(500, "Description cannot exceed 500 characters")
    .optional()
    .nullable(),
});

export const addSubscriberSchema = z.object({
  subscriberId: z.number(),
});

export const bulkAddSubscribersSchema = z.object({
  subscriberIds: z
    .array(z.number())
    .min(1, "Subscriber IDs array cannot be empty"),
});
