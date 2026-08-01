import { Request, Response, NextFunction } from "express";
import { AccessRequestStatus, AdminRole, Prisma } from "../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";
import { logger, maskPhone } from "../config/logger.js";
import {
  accessRequestListSchema,
  approveAccessRequestSchema,
  publicAccessRequestSchema,
  rejectAccessRequestSchema,
} from "../validators/accessRequest.js";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../utils/errors.js";
import { createAdminAccount, createTemporaryPassword } from "../services/adminAccount.js";
import { maskEmail } from "../utils/normalization.js";

const ACCESS_REQUEST_ENTITY = "AccessRequest";

const getRequestId = (req: Request) => req.id || "unknown";

const parseId = (value: string | string[] | undefined): number => {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) {
    throw new BadRequestError("Invalid access request ID");
  }
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw new BadRequestError("Invalid access request ID");
  }
  return id;
};

const ensureSuperAdmin = (req: Request) => {
  if (req.admin?.role !== AdminRole.SUPER_ADMIN) {
    throw new ForbiddenError("Only SUPER_ADMIN can manage access requests");
  }
};

const createSuperAdminNotifications = async (
  tx: Prisma.TransactionClient,
  accessRequestId: number,
  requesterName: string,
  email: string
) => {
  const superAdmins = await tx.admin.findMany({
    where: { role: AdminRole.SUPER_ADMIN, isActive: true },
    select: { id: true },
  });

  if (superAdmins.length === 0) return;

  await tx.adminNotification.createMany({
    data: superAdmins.map((admin) => ({
      adminId: admin.id,
      type: "ACCESS_REQUEST_CREATED",
      title: "New access request",
      message: `${requesterName} (${email}) requested platform access.`,
      entityType: ACCESS_REQUEST_ENTITY,
      entityId: accessRequestId,
      link: `/access-requests/${accessRequestId}`,
    })),
  });
};

export const submitAccessRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const validated = publicAccessRequestSchema.parse(req.body);

    if (validated.website) {
      throw new BadRequestError("Invalid request");
    }

    if (validated.formStartedAt && Date.now() - validated.formStartedAt < 1500) {
      throw new BadRequestError("Please review the form before submitting.");
    }

    const requesterName = `${validated.firstName} ${validated.lastName}`.trim();

    await prisma.$transaction(async (tx) => {
      const existingAdmin = await tx.admin.findUnique({
        where: { email: validated.email },
        select: { id: true, isActive: true },
      });

      if (existingAdmin?.isActive) {
        logger.warn("[AccessRequest] Existing active admin email blocked", {
          requestId: getRequestId(req),
          email: maskEmail(validated.email),
          phoneNumber: maskPhone(validated.phoneNumber),
        });
        return;
      }

      const existingPending = await tx.accessRequest.findFirst({
        where: {
          email: validated.email,
          status: AccessRequestStatus.PENDING,
        },
        select: { id: true },
      });

      if (existingPending) {
        logger.warn("[AccessRequest] Duplicate pending request blocked", {
          requestId: getRequestId(req),
          accessRequestId: existingPending.id,
          email: maskEmail(validated.email),
        });
        return;
      }

      const request = await tx.accessRequest.create({
        data: {
          firstName: validated.firstName,
          lastName: validated.lastName,
          email: validated.email,
          phoneNumber: validated.phoneNumber,
          company: validated.company,
          department: validated.department,
          reason: validated.reason,
          requestedRole: validated.requestedRole,
        },
      });

      await createSuperAdminNotifications(tx, request.id, requesterName, validated.email);

      await tx.auditLog.create({
        data: {
          adminId: null,
          action: "ACCESS_REQUEST_SUBMITTED",
          entityType: ACCESS_REQUEST_ENTITY,
          entityId: request.id,
          metadata: {
            requestId: request.id,
            requesterEmail: maskEmail(validated.email),
            requestedRole: validated.requestedRole || null,
          },
        },
      });

      logger.info("[AccessRequest] Submitted", {
        requestId: getRequestId(req),
        accessRequestId: request.id,
        email: maskEmail(validated.email),
        phoneNumber: maskPhone(validated.phoneNumber),
      });
    });

    res.status(201).json({
      success: true,
      message: "Your access request has been submitted for review.",
    });
  } catch (error) {
    next(error);
  }
};

export const listAccessRequests = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    ensureSuperAdmin(req);
    const query = accessRequestListSchema.parse(req.query);
    const where: Prisma.AccessRequestWhereInput = {};

    if (query.status) where.status = query.status;
    if (query.requestedRole) where.requestedRole = query.requestedRole;
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {
        ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
        ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
      };
    }
    if (query.search) {
      where.OR = [
        { firstName: { contains: query.search } },
        { lastName: { contains: query.search } },
        { email: { contains: query.search } },
        { phoneNumber: { contains: query.search } },
        { company: { contains: query.search } },
      ];
    }

    const [requests, total, pendingCount] = await Promise.all([
      prisma.accessRequest.findMany({
        where,
        orderBy: { [query.sortBy]: query.sortOrder },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phoneNumber: true,
          company: true,
          requestedRole: true,
          status: true,
          createdAt: true,
          reviewedAt: true,
        },
      }),
      prisma.accessRequest.count({ where }),
      prisma.accessRequest.count({ where: { status: AccessRequestStatus.PENDING } }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        requests,
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
        pendingCount,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getAccessRequestById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    ensureSuperAdmin(req);
    const id = parseId(req.params.id);

    const request = await prisma.accessRequest.findUnique({
      where: { id },
      include: {
        reviewedBy: { select: { id: true, name: true, email: true, role: true } },
        createdAdmin: { select: { id: true, name: true, email: true, role: true, isActive: true } },
      },
    });

    if (!request) {
      throw new NotFoundError("Access request not found");
    }

    const auditLogs = await prisma.auditLog.findMany({
      where: { entityType: ACCESS_REQUEST_ENTITY, entityId: id },
      include: { admin: { select: { id: true, name: true, role: true } } },
      orderBy: { createdAt: "desc" },
      take: 25,
    });

    res.status(200).json({
      success: true,
      data: { request, auditLogs },
    });
  } catch (error) {
    next(error);
  }
};

export const approveAccessRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    ensureSuperAdmin(req);
    const id = parseId(req.params.id);
    const adminId = req.admin!.id;
    const validated = approveAccessRequestSchema.parse(req.body);
    const temporaryPassword = validated.temporaryPassword || createTemporaryPassword();

    const result = await prisma.$transaction(async (tx) => {
      const request = await tx.accessRequest.findUnique({
        where: { id },
      });

      if (!request) {
        throw new NotFoundError("Access request not found");
      }
      if (request.status !== AccessRequestStatus.PENDING) {
        throw new BadRequestError("Only pending access requests can be approved");
      }

      const duplicateApproved = await tx.accessRequest.findFirst({
        where: {
          email: request.email,
          status: AccessRequestStatus.APPROVED,
          id: { not: request.id },
        },
        select: { id: true },
      });
      if (duplicateApproved) {
        throw new ConflictError("An approved access request already exists for this email");
      }

      const admin = await createAdminAccount(tx, {
        name: `${request.firstName} ${request.lastName}`.trim(),
        email: request.email,
        password: temporaryPassword,
        role: validated.role,
        isActive: true,
      });

      const updated = await tx.accessRequest.update({
        where: { id },
        data: {
          status: AccessRequestStatus.APPROVED,
          reviewedById: adminId,
          reviewedAt: new Date(),
          approvalNotes: validated.notes,
          createdAdminId: admin.id,
        },
        include: {
          reviewedBy: { select: { id: true, name: true, email: true, role: true } },
          createdAdmin: { select: { id: true, name: true, email: true, role: true, isActive: true } },
        },
      });

      await tx.auditLog.createMany({
        data: [
          {
            adminId,
            action: "ACCESS_REQUEST_APPROVED",
            entityType: ACCESS_REQUEST_ENTITY,
            entityId: request.id,
            metadata: {
              requestId: request.id,
              requesterEmail: maskEmail(request.email),
              approvingAdminId: adminId,
              assignedRole: validated.role,
              createdAdminId: admin.id,
            },
          },
          {
            adminId,
            action: "ADMIN_CREATED_FROM_ACCESS_REQUEST",
            entityType: "Admin",
            entityId: admin.id,
            metadata: {
              requestId: request.id,
              assignedRole: validated.role,
            },
          },
        ],
      });

      return {
        updated,
        generatedPassword:
          process.env.NODE_ENV !== "production" && !validated.temporaryPassword
            ? temporaryPassword
            : null,
      };
    });

    logger.info("[AccessRequest] Approved and admin account created", {
      requestId: getRequestId(req),
      accessRequestId: id,
      adminId,
      assignedRole: validated.role,
      createdAdminId: result.updated.createdAdminId,
    });

    res.status(200).json({
      success: true,
      data: {
        request: result.updated,
        temporaryPassword: result.generatedPassword,
        temporaryPasswordNotice: result.generatedPassword
          ? "Sensitive: shown once to the approving Super Admin. It is not logged or stored in plaintext."
          : undefined,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const rejectAccessRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    ensureSuperAdmin(req);
    const id = parseId(req.params.id);
    const adminId = req.admin!.id;
    const validated = rejectAccessRequestSchema.parse(req.body);

    const updated = await prisma.$transaction(async (tx) => {
      const request = await tx.accessRequest.findUnique({
        where: { id },
      });
      if (!request) throw new NotFoundError("Access request not found");
      if (request.status !== AccessRequestStatus.PENDING) {
        throw new BadRequestError("Only pending access requests can be rejected");
      }

      const rejected = await tx.accessRequest.update({
        where: { id },
        data: {
          status: AccessRequestStatus.REJECTED,
          reviewedById: adminId,
          reviewedAt: new Date(),
          rejectionReason: validated.reason,
        },
      });

      await tx.auditLog.create({
        data: {
          adminId,
          action: "ACCESS_REQUEST_REJECTED",
          entityType: ACCESS_REQUEST_ENTITY,
          entityId: id,
          metadata: {
            requestId: id,
            requesterEmail: maskEmail(request.email),
            approvingAdminId: adminId,
          },
        },
      });

      return rejected;
    });

    logger.info("[AccessRequest] Rejected", {
      requestId: getRequestId(req),
      accessRequestId: id,
      adminId,
    });

    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

export const withdrawAccessRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    ensureSuperAdmin(req);
    const id = parseId(req.params.id);
    const adminId = req.admin!.id;

    const updated = await prisma.$transaction(async (tx) => {
      const request = await tx.accessRequest.findUnique({ where: { id } });
      if (!request) throw new NotFoundError("Access request not found");
      if (request.status !== AccessRequestStatus.PENDING) {
        throw new BadRequestError("Only pending access requests can be withdrawn");
      }

      const withdrawn = await tx.accessRequest.update({
        where: { id },
        data: {
          status: AccessRequestStatus.WITHDRAWN,
          reviewedById: adminId,
          reviewedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          adminId,
          action: "ACCESS_REQUEST_WITHDRAWN",
          entityType: ACCESS_REQUEST_ENTITY,
          entityId: id,
          metadata: { requestId: id, requesterEmail: maskEmail(request.email) },
        },
      });

      return withdrawn;
    });

    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

export const deleteAccessRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    ensureSuperAdmin(req);
    const id = parseId(req.params.id);
    const adminId = req.admin!.id;

    await prisma.$transaction(async (tx) => {
      const request = await tx.accessRequest.findUnique({ where: { id } });
      if (!request) throw new NotFoundError("Access request not found");
      if (request.status === AccessRequestStatus.APPROVED) {
        throw new BadRequestError("Approved access requests cannot be deleted");
      }

      await tx.auditLog.create({
        data: {
          adminId,
          action: "ACCESS_REQUEST_DELETED",
          entityType: ACCESS_REQUEST_ENTITY,
          entityId: id,
          metadata: { requestId: id, requesterEmail: maskEmail(request.email) },
        },
      });
      await tx.adminNotification.deleteMany({
        where: { entityType: ACCESS_REQUEST_ENTITY, entityId: id },
      });
      await tx.accessRequest.delete({ where: { id } });
    });

    res.status(200).json({ success: true, message: "Access request deleted" });
  } catch (error) {
    next(error);
  }
};
