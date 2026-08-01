import { Request, Response, NextFunction } from "express";
import { prisma } from "../config/prisma.js";
import { logger } from "../config/logger.js";
import { logAuditEvent } from "../utils/audit.js";
import {
  createGroupSchema,
  updateGroupSchema,
  addSubscriberSchema,
  bulkAddSubscribersSchema,
} from "../validators/group.js";
import {
  BadRequestError,
  NotFoundError,
  ConflictError,
} from "../utils/errors.js";

export const getGroups = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 10));
    const search = (req.query.search as string)?.trim() || "";

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const [groups, total] = await Promise.all([
      prisma.subscriberGroup.findMany({
        where,
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          _count: { select: { members: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.subscriberGroup.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        groups: groups.map((g) => ({
          id: g.id,
          name: g.name,
          description: g.description,
          memberCount: g._count.members,
          createdBy: g.createdBy,
          createdAt: g.createdAt,
          updatedAt: g.updatedAt,
        })),
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

export const getGroupById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      throw new BadRequestError("Invalid group ID");
    }

    const group = await prisma.subscriberGroup.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        _count: { select: { members: true } },
      },
    });

    if (!group) {
      throw new NotFoundError("Subscriber group not found");
    }

    res.status(200).json({
      success: true,
      data: {
        id: group.id,
        name: group.name,
        description: group.description,
        memberCount: group._count.members,
        createdBy: group.createdBy,
        createdAt: group.createdAt,
        updatedAt: group.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getGroupMembers = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      throw new BadRequestError("Invalid group ID");
    }

    const group = await prisma.subscriberGroup.findUnique({
      where: { id },
    });

    if (!group) {
      throw new NotFoundError("Subscriber group not found");
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 10));
    const search = (req.query.search as string)?.trim() || "";

    const where: any = { groupId: id };
    if (search) {
      where.subscriber = {
        OR: [
          { name: { contains: search } },
          { phoneNumber: { contains: search } },
        ],
      };
    }

    const [members, total] = await Promise.all([
      prisma.subscriberGroupMember.findMany({
        where,
        include: {
          subscriber: true,
          addedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.subscriberGroupMember.count({ where }),
    ]);

    // Mask phone numbers if current caller is a VIEWER
    const isViewer = req.admin?.role === "VIEWER";
    const maskPhone = (phone: string): string => {
      if (phone.length <= 4) return "••••";
      return phone.slice(0, -4).replace(/./g, "•") + phone.slice(-4);
    };

    res.status(200).json({
      success: true,
      data: {
        members: members.map((m) => ({
          id: m.id,
          subscriber: {
            ...m.subscriber,
            phoneNumber: isViewer ? maskPhone(m.subscriber.phoneNumber) : m.subscriber.phoneNumber,
          },
          addedBy: m.addedBy,
          createdAt: m.createdAt,
        })),
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

export const createGroup = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const validated = createGroupSchema.parse(req.body);
    const creatorId = req.admin?.id;
    if (!creatorId) {
      throw new BadRequestError("Authenticated administrator required");
    }

    const normalizedName = validated.name.trim().replace(/\s+/g, " ");

    // Check for duplicate group name
    const existing = await prisma.subscriberGroup.findUnique({
      where: { name: normalizedName },
    });

    if (existing) {
      throw new ConflictError("A subscriber group with this name already exists");
    }

    const group = await prisma.subscriberGroup.create({
      data: {
        name: normalizedName,
        description: validated.description,
        createdById: creatorId,
      },
    });

    await logAuditEvent({
      adminId: creatorId,
      action: "GROUP_CREATED",
      entityType: "SubscriberGroup",
      entityId: group.id,
      metadata: { name: group.name },
    });

    logger.info(`Group created successfully by Admin ID: ${creatorId}`, {
      groupId: group.id,
      name: group.name,
      requestId: req.id as string,
    });

    res.status(201).json({
      success: true,
      data: group,
    });
  } catch (error) {
    next(error);
  }
};

export const updateGroup = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      throw new BadRequestError("Invalid group ID");
    }

    const validated = updateGroupSchema.parse(req.body);
    const creatorId = req.admin?.id;
    if (!creatorId) {
      throw new BadRequestError("Authenticated administrator required");
    }

    const group = await prisma.subscriberGroup.findUnique({
      where: { id },
    });

    if (!group) {
      throw new NotFoundError("Subscriber group not found");
    }

    const updateData: any = {};
    if (validated.name !== undefined) {
      const normalizedName = validated.name.trim().replace(/\s+/g, " ");
      if (normalizedName !== group.name) {
        const existing = await prisma.subscriberGroup.findUnique({
          where: { name: normalizedName },
        });
        if (existing) {
          throw new ConflictError("A subscriber group with this name already exists");
        }
        updateData.name = normalizedName;
      }
    }

    if (validated.description !== undefined) {
      updateData.description = validated.description;
    }

    const updatedGroup = await prisma.subscriberGroup.update({
      where: { id },
      data: updateData,
    });

    await logAuditEvent({
      adminId: creatorId,
      action: "GROUP_CHANGED",
      entityType: "SubscriberGroup",
      entityId: updatedGroup.id,
      metadata: { changes: updateData },
    });

    logger.info(`Group ID ${id} updated by Admin ID: ${creatorId}`, {
      groupId: id,
      requestId: req.id as string,
    });

    res.status(200).json({
      success: true,
      data: updatedGroup,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteGroup = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      throw new BadRequestError("Invalid group ID");
    }

    const creatorId = req.admin?.id;
    if (!creatorId) {
      throw new BadRequestError("Authenticated administrator required");
    }

    const group = await prisma.subscriberGroup.findUnique({
      where: { id },
    });

    if (!group) {
      throw new NotFoundError("Subscriber group not found");
    }

    // Check if any non-cancelled broadcasts reference this group
    const referencingBroadcast = await prisma.broadcast.findFirst({
      where: {
        groupId: id,
        status: { not: "CANCELLED" },
      },
    });

    if (referencingBroadcast) {
      throw new ConflictError(
        "Cannot delete group. It is currently referenced by one or more active broadcasts."
      );
    }

    await prisma.subscriberGroup.delete({
      where: { id },
    });

    await logAuditEvent({
      adminId: creatorId,
      action: "GROUP_DELETED",
      entityType: "SubscriberGroup",
      entityId: id,
      metadata: { name: group.name },
    });

    logger.info(`Group ID ${id} deleted by Admin ID: ${creatorId}`, {
      groupId: id,
      name: group.name,
      requestId: req.id as string,
    });

    res.status(200).json({
      success: true,
      message: "Group deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const addGroupMember = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      throw new BadRequestError("Invalid group ID");
    }

    const validated = addSubscriberSchema.parse(req.body);
    const adminId = req.admin?.id || null;

    // Check group exists
    const group = await prisma.subscriberGroup.findUnique({ where: { id } });
    if (!group) {
      throw new NotFoundError("Subscriber group not found");
    }

    // Check subscriber exists
    const subscriber = await prisma.subscriber.findUnique({
      where: { id: validated.subscriberId },
    });
    if (!subscriber) {
      throw new NotFoundError("Subscriber not found");
    }

    // Check duplicate membership
    const existing = await prisma.subscriberGroupMember.findUnique({
      where: {
        groupId_subscriberId: {
          groupId: id,
          subscriberId: validated.subscriberId,
        },
      },
    });

    if (existing) {
      res.status(200).json({
        success: true,
        message: "Subscriber is already a member of this group",
      });
      return;
    }

    const member = await prisma.subscriberGroupMember.create({
      data: {
        groupId: id,
        subscriberId: validated.subscriberId,
        addedById: adminId,
      },
    });

    await logAuditEvent({
      adminId,
      action: "GROUP_MEMBER_ADDED",
      entityType: "SubscriberGroup",
      entityId: id,
      metadata: { subscriberId: validated.subscriberId },
    });

    logger.info(`Subscriber ID ${validated.subscriberId} added to Group ID ${id}`, {
      groupId: id,
      subscriberId: validated.subscriberId,
      requestId: req.id as string,
    });

    res.status(201).json({
      success: true,
      data: member,
    });
  } catch (error) {
    next(error);
  }
};

export const removeGroupMember = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    const subscriberId = parseInt(req.params.subscriberId as string);
    if (isNaN(id) || isNaN(subscriberId)) {
      throw new BadRequestError("Invalid parameter IDs");
    }

    const adminId = req.admin?.id || null;

    const existing = await prisma.subscriberGroupMember.findUnique({
      where: {
        groupId_subscriberId: {
          groupId: id,
          subscriberId,
        },
      },
    });

    if (!existing) {
      throw new NotFoundError("Subscriber is not a member of this group");
    }

    await prisma.subscriberGroupMember.delete({
      where: {
        groupId_subscriberId: {
          groupId: id,
          subscriberId,
        },
      },
    });

    await logAuditEvent({
      adminId,
      action: "GROUP_MEMBER_REMOVED",
      entityType: "SubscriberGroup",
      entityId: id,
      metadata: { subscriberId },
    });

    logger.info(`Subscriber ID ${subscriberId} removed from Group ID ${id}`, {
      groupId: id,
      subscriberId,
      requestId: req.id as string,
    });

    res.status(200).json({
      success: true,
      message: "Subscriber removed from group successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const bulkAddGroupMembers = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      throw new BadRequestError("Invalid group ID");
    }

    const validated = bulkAddSubscribersSchema.parse(req.body);
    const adminId = req.admin?.id || null;

    // Check group exists
    const group = await prisma.subscriberGroup.findUnique({ where: { id } });
    if (!group) {
      throw new NotFoundError("Subscriber group not found");
    }

    // Verify all subscribers exist
    const uniqueIds = Array.from(new Set(validated.subscriberIds));
    const subscribers = await prisma.subscriber.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true },
    });

    if (subscribers.length !== uniqueIds.length) {
      throw new BadRequestError("One or more subscriber IDs do not exist");
    }

    // Run bulk addition in a transaction
    await prisma.$transaction(async (tx) => {
      for (const subscriberId of uniqueIds) {
        // Upsert style: ignore duplicates
        await tx.subscriberGroupMember.upsert({
          where: {
            groupId_subscriberId: {
              groupId: id,
              subscriberId,
            },
          },
          update: {},
          create: {
            groupId: id,
            subscriberId,
            addedById: adminId,
          },
        });
      }
    });

    await logAuditEvent({
      adminId,
      action: "GROUP_BULK_ADDED",
      entityType: "SubscriberGroup",
      entityId: id,
      metadata: { count: uniqueIds.length },
    });

    logger.info(`Bulk added ${uniqueIds.length} subscribers to Group ID ${id}`, {
      groupId: id,
      count: uniqueIds.length,
      requestId: req.id as string,
    });

    res.status(200).json({
      success: true,
      message: `Successfully processed membership for ${uniqueIds.length} subscribers`,
    });
  } catch (error) {
    next(error);
  }
};
