import { z } from "zod";
import { BroadcastCategory, BroadcastSeverity, BroadcastAudienceType } from "../generated/prisma/client.js";

const baseBroadcastObject = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(100, "Title cannot exceed 100 characters"),
  message: z
    .string()
    .trim()
    .min(1, "Message is required")
    .max(2000, "Message cannot exceed 2000 characters"),
  category: z.nativeEnum(BroadcastCategory),
  severity: z.nativeEnum(BroadcastSeverity),
  audienceType: z.nativeEnum(BroadcastAudienceType),
  groupId: z
    .number()
    .int()
    .positive("Group ID must be a positive integer")
    .optional()
    .nullable(),
  messageTemplateId: z.number().int().positive().optional().nullable(),
  templateVariables: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .optional()
    .nullable(),
});

export const createBroadcastSchema = baseBroadcastObject
  .refine(
    (data) => {
      if (data.audienceType === BroadcastAudienceType.GROUP && !data.groupId) {
        return false;
      }
      return true;
    },
    {
      message: "Group selection is required when audience type is Group",
      path: ["groupId"],
    }
  )
  .refine(
    (data) => {
      if (data.audienceType === BroadcastAudienceType.ALL_ACTIVE_SUBSCRIBERS && data.groupId !== undefined && data.groupId !== null) {
        return false;
      }
      return true;
    },
    {
      message: "Group ID must be null when audience type is All Active Subscribers",
      path: ["groupId"],
    }
  );

// Fix Zod partial() crash on refined schemas
export const updateBroadcastSchema = baseBroadcastObject
  .partial()
  .refine(
    (data) => {
      if (data.audienceType === BroadcastAudienceType.GROUP && !data.groupId) {
        return false;
      }
      return true;
    },
    {
      message: "Group selection is required when audience type is Group",
      path: ["groupId"],
    }
  );

export const rejectBroadcastSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, "Rejection reason is required")
    .max(500, "Rejection reason cannot exceed 500 characters"),
});

export const cancelBroadcastSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, "Cancellation reason is required")
    .max(500, "Cancellation reason cannot exceed 500 characters"),
});
