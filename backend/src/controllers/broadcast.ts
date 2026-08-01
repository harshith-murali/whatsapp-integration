import { Request, Response, NextFunction } from "express";
import { prisma } from "../config/prisma.js";
import { logger } from "../config/logger.js";
import { logAuditEvent } from "../utils/audit.js";
import {
  createBroadcastSchema,
  updateBroadcastSchema,
  rejectBroadcastSchema,
  cancelBroadcastSchema,
} from "../validators/broadcast.js";
import {
  BadRequestError,
  NotFoundError,
  ConflictError,
  AppError,
} from "../utils/errors.js";
import {
  BroadcastStatus,
  BroadcastAudienceType,
  SubscriberStatus,
  MessageStatus,
  MessageTemplateStatus,
} from "../generated/prisma/client.js";
import { getMessageProviderMode } from "../config/env.js";

/** Helper to mask subscriber phone numbers in previews */
const maskPhone = (phone: string): string => {
  if (phone.length <= 4) return "••••";
  return phone.slice(0, -4).replace(/./g, "•") + phone.slice(-4);
};

export const getBroadcasts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 10));
    const search = (req.query.search as string)?.trim() || "";
    const status = req.query.status as BroadcastStatus | undefined;
    const category = req.query.category as any;
    const severity = req.query.severity as any;
    const createdById = req.query.createdById ? parseInt(req.query.createdById as string) : undefined;

    const where: any = {};

    if (status) {
      where.status = status;
    }
    if (category) {
      where.category = category;
    }
    if (severity) {
      where.severity = severity;
    }
    if (createdById) {
      where.createdById = createdById;
    }

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { message: { contains: search } },
      ];
    }

    // Role-specific viewing visibility restrictions
    // OPERATOR can only view their own drafts (others must be submitted / pending / approved)
    const isAdmin = req.admin?.role === "SUPER_ADMIN" || req.admin?.role === "ADMIN";
    if (!isAdmin && req.admin) {
      where.OR = [
        { createdById: req.admin.id }, // Can see their own drafts
        { status: { not: BroadcastStatus.DRAFT } }, // Can see any submitted/active/approved/queued broadcasts
      ];
    }

    const [broadcasts, total] = await Promise.all([
      prisma.broadcast.findMany({
        where,
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          group: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.broadcast.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        broadcasts,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getBroadcastById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      throw new BadRequestError("Invalid broadcast ID");
    }

    const broadcast = await prisma.broadcast.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        approvedBy: { select: { id: true, name: true } },
        rejectedBy: { select: { id: true, name: true } },
        group: { select: { id: true, name: true } },
      },
    });

    if (!broadcast) {
      throw new NotFoundError("Broadcast not found");
    }

    // Role-based visibility check
    const isAdmin = req.admin?.role === "SUPER_ADMIN" || req.admin?.role === "ADMIN";
    if (!isAdmin && req.admin && broadcast.status === BroadcastStatus.DRAFT && broadcast.createdById !== req.admin.id) {
      throw new NotFoundError("Broadcast not found"); // Block operator from viewing others' drafts
    }

    // Calculate message counts by status for delivery progress tracking
    const messageStats = { QUEUED: 0, PROCESSING: 0, SUBMITTED: 0, FAILED: 0, CANCELLED: 0 };
    const aggregates = await prisma.message.groupBy({
      by: ["status"],
      where: { broadcastId: id },
      _count: { id: true },
    });

    for (const group of aggregates) {
      const key = group.status as keyof typeof messageStats;
      if (messageStats[key] !== undefined) {
        messageStats[key] = group._count.id;
      }
    }

    res.status(200).json({
      success: true,
      data: {
        ...broadcast,
        messageStats,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const createBroadcast = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const validated = createBroadcastSchema.parse(req.body);
    const creatorId = req.admin?.id;
    if (!creatorId) {
      throw new BadRequestError("Authenticated administrator required");
    }

    // If group, verify group exists
    if (validated.audienceType === BroadcastAudienceType.GROUP && validated.groupId) {
      const groupExists = await prisma.subscriberGroup.findUnique({
        where: { id: validated.groupId },
      });
      if (!groupExists) {
        throw new NotFoundError("Selected subscriber group not found");
      }
    }

    const broadcast = await prisma.broadcast.create({
      data: {
        title: validated.title,
        message: validated.message,
        messageTemplateId: validated.messageTemplateId || null,
        templateVariables: validated.templateVariables || undefined,
        category: validated.category,
        severity: validated.severity,
        audienceType: validated.audienceType,
        groupId: validated.groupId || null,
        status: BroadcastStatus.DRAFT,
        createdById: creatorId,
        totalRecipients: 0,
      },
    });

    await logAuditEvent({
      adminId: creatorId,
      action: "BROADCAST_CREATED",
      entityType: "Broadcast",
      entityId: broadcast.id,
      metadata: { title: broadcast.title },
    });

    logger.info(`Broadcast draft created: ID ${broadcast.id} by Admin ID: ${creatorId}`, {
      broadcastId: broadcast.id,
      requestId: req.id as string,
    });

    res.status(201).json({
      success: true,
      data: broadcast,
    });
  } catch (error) {
    next(error);
  }
};

export const updateBroadcast = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      throw new BadRequestError("Invalid broadcast ID");
    }

    const validated = updateBroadcastSchema.parse(req.body);
    const adminId = req.admin?.id;
    const adminRole = req.admin?.role;

    if (!adminId || !adminRole) {
      throw new BadRequestError("Authenticated administrator required");
    }

    const broadcast = await prisma.broadcast.findUnique({
      where: { id },
    });

    if (!broadcast) {
      throw new NotFoundError("Broadcast not found");
    }

    // Verify editable state: only DRAFT or REJECTED
    if (broadcast.status !== BroadcastStatus.DRAFT && broadcast.status !== BroadcastStatus.REJECTED) {
      throw new ConflictError("Only broadcasts in DRAFT or REJECTED status can be updated");
    }

    // Verify OPERATOR ownership: can only update their own drafts
    const isAdmin = adminRole === "SUPER_ADMIN" || adminRole === "ADMIN";
    if (!isAdmin && broadcast.createdById !== adminId) {
      throw new ConflictError("You do not have permission to edit this broadcast");
    }

    // If group, verify group exists
    if (validated.audienceType === BroadcastAudienceType.GROUP && validated.groupId) {
      const groupExists = await prisma.subscriberGroup.findUnique({
        where: { id: validated.groupId },
      });
      if (!groupExists) {
        throw new NotFoundError("Selected subscriber group not found");
      }
    }

    const updateData: any = {
      title: validated.title,
      message: validated.message,
      messageTemplateId: validated.messageTemplateId,
      templateVariables: validated.templateVariables,
      category: validated.category,
      severity: validated.severity,
      audienceType: validated.audienceType,
      groupId: validated.groupId || null,
    };

    // If resubmitting or modifying a rejected broadcast, revert status to DRAFT and clear rejection fields
    if (broadcast.status === BroadcastStatus.REJECTED) {
      updateData.status = BroadcastStatus.DRAFT;
      updateData.rejectionReason = null;
      updateData.rejectedAt = null;
      updateData.rejectedById = null;
    }

    const updated = await prisma.broadcast.update({
      where: { id },
      data: updateData,
    });

    await logAuditEvent({
      adminId,
      action: "BROADCAST_UPDATED",
      entityType: "Broadcast",
      entityId: id,
      metadata: { status: updated.status },
    });

    logger.info(`Broadcast draft updated: ID ${id} by Admin ID: ${adminId}`, {
      broadcastId: id,
      requestId: req.id as string,
    });

    res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteBroadcast = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      throw new BadRequestError("Invalid broadcast ID");
    }

    const adminId = req.admin?.id;
    const adminRole = req.admin?.role;

    if (!adminId || !adminRole) {
      throw new BadRequestError("Authenticated administrator required");
    }

    const broadcast = await prisma.broadcast.findUnique({
      where: { id },
    });

    if (!broadcast) {
      throw new NotFoundError("Broadcast not found");
    }

    // Verify deletable state: only DRAFT
    if (broadcast.status !== BroadcastStatus.DRAFT) {
      throw new ConflictError("Only broadcasts in DRAFT status can be deleted");
    }

    // Verify OPERATOR ownership: can only delete their own drafts
    const isAdmin = adminRole === "SUPER_ADMIN" || adminRole === "ADMIN";
    if (!isAdmin && broadcast.createdById !== adminId) {
      throw new ConflictError("You do not have permission to delete this broadcast");
    }

    await prisma.broadcast.delete({
      where: { id },
    });

    await logAuditEvent({
      adminId,
      action: "BROADCAST_DELETED",
      entityType: "Broadcast",
      entityId: id,
      metadata: { title: broadcast.title },
    });

    logger.info(`Broadcast draft deleted: ID ${id} by Admin ID: ${adminId}`, {
      broadcastId: id,
      requestId: req.id as string,
    });

    res.status(200).json({
      success: true,
      message: "Broadcast draft deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const submitBroadcast = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      throw new BadRequestError("Invalid broadcast ID");
    }

    const adminId = req.admin?.id;
    const adminRole = req.admin?.role;

    if (!adminId || !adminRole) {
      throw new BadRequestError("Authenticated administrator required");
    }

    const broadcast = await prisma.broadcast.findUnique({
      where: { id },
    });

    if (!broadcast) {
      throw new NotFoundError("Broadcast not found");
    }

    // Verify eligible submission status
    if (broadcast.status !== BroadcastStatus.DRAFT && broadcast.status !== BroadcastStatus.REJECTED) {
      throw new ConflictError("Only broadcasts in DRAFT or REJECTED status can be submitted for approval");
    }

    // Verify OPERATOR ownership: can only submit their own
    const isAdmin = adminRole === "SUPER_ADMIN" || adminRole === "ADMIN";
    if (!isAdmin && broadcast.createdById !== adminId) {
      throw new ConflictError("You do not have permission to submit this broadcast");
    }

    const updated = await prisma.broadcast.update({
      where: { id },
      data: {
        status: BroadcastStatus.PENDING_APPROVAL,
        submittedAt: new Date(),
        // Clear previous rejection reasons
        rejectionReason: null,
        rejectedAt: null,
        rejectedById: null,
      },
    });

    await logAuditEvent({
      adminId,
      action: "BROADCAST_SUBMITTED",
      entityType: "Broadcast",
      entityId: id,
    });

    logger.info(`Broadcast submitted for approval: ID ${id} by Admin ID: ${adminId}`, {
      broadcastId: id,
      requestId: req.id as string,
    });

    res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

export const approveBroadcast = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      throw new BadRequestError("Invalid broadcast ID");
    }

    const adminId = req.admin?.id;
    if (!adminId) {
      throw new BadRequestError("Authenticated administrator required");
    }

    const broadcast = await prisma.broadcast.findUnique({
      where: { id },
    });

    if (!broadcast) {
      throw new NotFoundError("Broadcast not found");
    }

    if (broadcast.status !== BroadcastStatus.PENDING_APPROVAL) {
      throw new ConflictError("Only broadcasts in PENDING_APPROVAL status can be approved");
    }

    const updated = await prisma.broadcast.update({
      where: { id },
      data: {
        status: BroadcastStatus.APPROVED,
        approvedById: adminId,
        approvedAt: new Date(),
        rejectionReason: null,
        rejectedAt: null,
        rejectedById: null,
      },
    });

    await logAuditEvent({
      adminId,
      action: "BROADCAST_APPROVED",
      entityType: "Broadcast",
      entityId: id,
    });

    logger.info(`Broadcast approved: ID ${id} by Admin ID: ${adminId}`, {
      broadcastId: id,
      requestId: req.id as string,
    });

    res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

export const rejectBroadcast = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      throw new BadRequestError("Invalid broadcast ID");
    }

    const validated = rejectBroadcastSchema.parse(req.body);
    const adminId = req.admin?.id;
    if (!adminId) {
      throw new BadRequestError("Authenticated administrator required");
    }

    const broadcast = await prisma.broadcast.findUnique({
      where: { id },
    });

    if (!broadcast) {
      throw new NotFoundError("Broadcast not found");
    }

    if (broadcast.status !== BroadcastStatus.PENDING_APPROVAL) {
      throw new ConflictError("Only broadcasts in PENDING_APPROVAL status can be rejected");
    }

    const updated = await prisma.broadcast.update({
      where: { id },
      data: {
        status: BroadcastStatus.REJECTED,
        rejectedById: adminId,
        rejectedAt: new Date(),
        rejectionReason: validated.reason,
      },
    });

    await logAuditEvent({
      adminId,
      action: "BROADCAST_REJECTED",
      entityType: "Broadcast",
      entityId: id,
      metadata: { reason: validated.reason },
    });

    logger.info(`Broadcast rejected: ID ${id} by Admin ID: ${adminId}`, {
      broadcastId: id,
      reason: validated.reason,
      requestId: req.id as string,
    });

    res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

/** Resolver for eligible subscribers matching broadcast audience criteria */
const getEligibleSubscribers = async (broadcast: any) => {
  const baseWhere: any = {
    status: SubscriberStatus.ACTIVE,
    optedIn: true,
  };

  if (broadcast.audienceType === BroadcastAudienceType.GROUP && broadcast.groupId) {
    baseWhere.groupMemberships = {
      some: {
        groupId: broadcast.groupId,
      },
    };
  }

  const subscribers = await prisma.subscriber.findMany({
    where: baseWhere,
    select: {
      id: true,
      phoneNumber: true,
    },
  });

  // Deduplicate on phone number level
  const seenPhones = new Set<string>();
  return subscribers.filter((sub) => {
    const normPhone = sub.phoneNumber.trim().replace(/\D/g, "");
    if (seenPhones.has(normPhone)) return false;
    seenPhones.add(normPhone);
    return true;
  });
};

export const getRecipientPreview = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      throw new BadRequestError("Invalid broadcast ID");
    }

    const broadcast = await prisma.broadcast.findUnique({
      where: { id },
    });

    if (!broadcast) {
      throw new NotFoundError("Broadcast not found");
    }

    // Resolve matched subscriber counts and statistics
    const totalMatched = await prisma.subscriber.count({
      where:
        broadcast.audienceType === BroadcastAudienceType.GROUP && broadcast.groupId
          ? { groupMemberships: { some: { groupId: broadcast.groupId } } }
          : {},
    });

    const excludedUnsubscribed = await prisma.subscriber.count({
      where: {
        status: SubscriberStatus.UNSUBSCRIBED,
        ...(broadcast.audienceType === BroadcastAudienceType.GROUP && broadcast.groupId
          ? { groupMemberships: { some: { groupId: broadcast.groupId } } }
          : {}),
      },
    });

    const excludedBlocked = await prisma.subscriber.count({
      where: {
        status: SubscriberStatus.BLOCKED,
        ...(broadcast.audienceType === BroadcastAudienceType.GROUP && broadcast.groupId
          ? { groupMemberships: { some: { groupId: broadcast.groupId } } }
          : {}),
      },
    });

    const excludedOptedOut = await prisma.subscriber.count({
      where: {
        optedIn: false,
        status: SubscriberStatus.ACTIVE,
        ...(broadcast.audienceType === BroadcastAudienceType.GROUP && broadcast.groupId
          ? { groupMemberships: { some: { groupId: broadcast.groupId } } }
          : {}),
      },
    });

    // Fetch actual eligible list
    const eligible = await getEligibleSubscribers(broadcast);
    const eligibleCount = eligible.length;

    // Calculate duplicate count
    const duplicateNumbersExcluded = Math.max(
      0,
      totalMatched - (excludedUnsubscribed + excludedBlocked + excludedOptedOut) - eligibleCount
    );

    // Fetch sample data (at most 5 records, masked sample names/phones)
    const rawSamples = await prisma.subscriber.findMany({
      where: {
        status: SubscriberStatus.ACTIVE,
        optedIn: true,
        ...(broadcast.audienceType === BroadcastAudienceType.GROUP && broadcast.groupId
          ? { groupMemberships: { some: { groupId: broadcast.groupId } } }
          : {}),
      },
      take: 5,
      select: {
        id: true,
        name: true,
        phoneNumber: true,
      },
    });

    const sampleRecipients = rawSamples.map((sub) => ({
      id: sub.id,
      name: sub.name || "No Name Provided",
      phoneNumber: maskPhone(sub.phoneNumber),
    }));

    res.status(200).json({
      success: true,
      data: {
        totalMatched,
        eligibleRecipients: eligibleCount,
        excludedUnsubscribed,
        excludedBlocked,
        excludedOptedOut,
        duplicateNumbersExcluded,
        sampleRecipients,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const queueBroadcast = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      throw new BadRequestError("Invalid broadcast ID");
    }

    const adminId = req.admin?.id;
    if (!adminId) {
      throw new BadRequestError("Authenticated administrator required");
    }

    // Run queue transactional steps atomically
    const result = await prisma.$transaction(async (tx) => {
      // 1. Lock and validate broadcast status
      const broadcast = await tx.broadcast.findUnique({
        where: { id },
        include: { messageTemplate: true },
      });

      if (!broadcast) {
        throw new NotFoundError("Broadcast not found");
      }

      if (broadcast.status !== BroadcastStatus.APPROVED) {
        throw new ConflictError("Only APPROVED broadcasts can be queued");
      }

      if (getMessageProviderMode() === "meta") {
        if (!broadcast.messageTemplate || broadcast.messageTemplate.status !== MessageTemplateStatus.APPROVED) {
          throw new ConflictError("Meta broadcasts require a synced APPROVED WhatsApp template before queueing");
        }
      }

      // 2. Resolve eligible subscribers dynamically at queue time
      const baseWhere: any = {
        status: SubscriberStatus.ACTIVE,
        optedIn: true,
      };

      if (broadcast.audienceType === BroadcastAudienceType.GROUP && broadcast.groupId) {
        baseWhere.groupMemberships = {
          some: {
            groupId: broadcast.groupId,
          },
        };
      }

      const subscribers = await tx.subscriber.findMany({
        where: baseWhere,
        select: {
          id: true,
          phoneNumber: true,
        },
      });

      // Deduplicate
      const seenPhones = new Set<string>();
      const eligibleSubscribers = subscribers.filter((sub) => {
        const normPhone = sub.phoneNumber.trim().replace(/\D/g, "");
        if (seenPhones.has(normPhone)) return false;
        seenPhones.add(normPhone);
        return true;
      });

      const recipientCount = eligibleSubscribers.length;
      if (recipientCount === 0) {
        throw new AppError("Cannot queue broadcast. There are zero eligible active/opted-in recipients.", 422);
      }

      // 3. Create exactly one message row per recipient with QUEUED status
      const messageData = eligibleSubscribers.map((sub) => ({
        broadcastId: id,
        subscriberId: sub.id,
        phoneNumber: sub.phoneNumber,
        status: MessageStatus.QUEUED,
      }));

      // Create messages
      await tx.message.createMany({
        data: messageData,
        skipDuplicates: true, // Safety guard for unique constraints
      });

      // 4. Update Broadcast properties
      const updatedBroadcast = await tx.broadcast.update({
        where: { id },
        data: {
          status: BroadcastStatus.QUEUED,
          totalRecipients: recipientCount,
          queuedAt: new Date(),
          templateName: broadcast.messageTemplate?.name || broadcast.templateName,
          templateLanguage: broadcast.messageTemplate?.language || broadcast.templateLanguage,
          templateSnapshot: broadcast.messageTemplate
            ? {
                id: broadcast.messageTemplate.id,
                metaTemplateId: broadcast.messageTemplate.metaTemplateId,
                name: broadcast.messageTemplate.name,
                language: broadcast.messageTemplate.language,
                category: broadcast.messageTemplate.category,
                status: broadcast.messageTemplate.status,
                components: broadcast.messageTemplate.components,
                parameterSchema: broadcast.messageTemplate.parameterSchema,
              }
            : (broadcast.templateSnapshot === null ? undefined : broadcast.templateSnapshot as any),
        },
      });

      // 5. Create audit log
      await tx.auditLog.create({
        data: {
          adminId,
          action: "BROADCAST_QUEUED",
          entityType: "Broadcast",
          entityId: id,
          metadata: { recipientCount },
        },
      });

      return { updatedBroadcast, recipientCount };
    });

    logger.info(`Broadcast successfully queued: ID ${id} with ${result.recipientCount} messages`, {
      broadcastId: id,
      recipientCount: result.recipientCount,
      requestId: req.id as string,
    });

    res.status(200).json({
      success: true,
      data: result.updatedBroadcast,
    });
  } catch (error) {
    next(error);
  }
};

export const cancelBroadcast = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      throw new BadRequestError("Invalid broadcast ID");
    }

    const validated = cancelBroadcastSchema.parse(req.body);
    const adminId = req.admin?.id;
    if (!adminId) {
      throw new BadRequestError("Authenticated administrator required");
    }

    const result = await prisma.$transaction(async (tx) => {
      const broadcast = await tx.broadcast.findUnique({
        where: { id },
      });

      if (!broadcast) {
        throw new NotFoundError("Broadcast not found");
      }

      // Cancellation allowed for APPROVED, QUEUED, and PROCESSING statuses
      if (
        broadcast.status !== BroadcastStatus.APPROVED &&
        broadcast.status !== BroadcastStatus.QUEUED &&
        broadcast.status !== BroadcastStatus.PROCESSING
      ) {
        throw new ConflictError("Only APPROVED, QUEUED, or PROCESSING broadcasts can be cancelled");
      }

      // If QUEUED or PROCESSING, update remaining QUEUED messages to CANCELLED
      if (broadcast.status === BroadcastStatus.QUEUED || broadcast.status === BroadcastStatus.PROCESSING) {
        await tx.message.updateMany({
          where: {
            broadcastId: id,
            status: MessageStatus.QUEUED,
          },
          data: {
            status: MessageStatus.CANCELLED,
            cancelledAt: new Date(),
          },
        });
      }

      const updated = await tx.broadcast.update({
        where: { id },
        data: {
          status: BroadcastStatus.CANCELLED,
          cancelledAt: new Date(),
          cancellationReason: validated.reason,
        },
      });

      await tx.auditLog.create({
        data: {
          adminId,
          action: "BROADCAST_CANCELLED",
          entityType: "Broadcast",
          entityId: id,
          metadata: { reason: validated.reason },
        },
      });

      return updated;
    });

    logger.info(`Broadcast cancelled: ID ${id} by Admin ID: ${adminId}`, {
      broadcastId: id,
      reason: validated.reason,
      requestId: req.id as string,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const requeueFailedBroadcast = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      throw new BadRequestError("Invalid broadcast ID");
    }

    const adminId = req.admin?.id;
    if (!adminId) {
      throw new BadRequestError("Authenticated administrator required");
    }

    const result = await prisma.$transaction(async (tx) => {
      const broadcast = await tx.broadcast.findUnique({
        where: { id },
      });

      if (!broadcast) {
        throw new NotFoundError("Broadcast not found");
      }

      const terminalStatuses: string[] = [
        BroadcastStatus.COMPLETED,
        BroadcastStatus.PARTIALLY_FAILED,
        BroadcastStatus.FAILED,
      ];

      if (!terminalStatuses.includes(broadcast.status as string)) {
        throw new BadRequestError("Only completed or failed/partially-failed broadcasts can have messages requeued");
      }

      // Check if there are any failed messages
      const failedCount = await tx.message.count({
        where: { broadcastId: id, status: MessageStatus.FAILED },
      });

      if (failedCount === 0) {
        throw new BadRequestError("No FAILED messages found in this broadcast to requeue");
      }

      // Update failed messages to QUEUED status
      await tx.message.updateMany({
        where: {
          broadcastId: id,
          status: MessageStatus.FAILED,
        },
        data: {
          status: MessageStatus.QUEUED,
          retryCount: 0,
          errorCode: null,
          errorMessage: null,
          failedAt: null,
          nextRetryAt: null,
          lastAttemptAt: null,
        },
      });

      // Update broadcast status to PROCESSING (or QUEUED if it was entirely reset)
      const updated = await tx.broadcast.update({
        where: { id },
        data: {
          status: BroadcastStatus.PROCESSING,
          completedAt: null,
          failedAt: null,
        },
      });

      // Create Audit Log
      await tx.auditLog.create({
        data: {
          adminId,
          action: "BROADCAST_FAILED_MESSAGES_REQUEUED",
          entityType: "Broadcast",
          entityId: id,
          metadata: { requeuedCount: failedCount },
        },
      });

      return { updated, failedCount };
    });

    logger.info(`Requeued ${result.failedCount} failed messages for broadcast ID: ${id} by Admin ID: ${adminId}`, {
      broadcastId: id,
      requeuedCount: result.failedCount,
      adminId,
      requestId: req.id as string,
    });

    res.status(200).json({
      success: true,
      data: result.updated,
    });
  } catch (error) {
    next(error);
  }
};
