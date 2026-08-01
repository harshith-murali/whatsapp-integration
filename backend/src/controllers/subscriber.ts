import { Request, Response, NextFunction } from "express";
import { prisma } from "../config/prisma.js";
import { createSubscriberSchema, updateSubscriberSchema } from "../validators/subscriber.js";
import { BadRequestError, NotFoundError, ConflictError } from "../utils/errors.js";
import { SubscriberStatus, Prisma } from "../generated/prisma/client.js";

/**
 * Masks a phone number for VIEWER role.
 * Keeps the last 4 digits visible, replaces the rest with bullets.
 * e.g. "919876543210" -> "91987654••••"
 */
const maskPhone = (phone: string): string => {
  if (phone.length <= 4) return "••••";
  return phone.slice(0, -4).replace(/./g, "•") + phone.slice(-4);
};

export const getSubscribers = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const isViewer = req.admin?.role === "VIEWER";
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 10));
    const search = (req.query.search as string)?.trim() || "";
    const status = req.query.status as SubscriberStatus | undefined;
    const optedInQuery = req.query.optedIn as string | undefined;
    const sortBy = (req.query.sortBy as string) || "createdAt";
    const sortOrder = (req.query.sortOrder as "asc" | "desc") || "desc";

    const where: Prisma.SubscriberWhereInput = {};

    // Apply search filter
    // VIEWERs can only search by name (phone numbers are masked, searching them is meaningless)
    if (search) {
      if (isViewer) {
        where.OR = [{ name: { contains: search } }];
      } else {
        where.OR = [
          { name: { contains: search } },
          { phoneNumber: { contains: search } },
        ];
      }
    }

    // Apply status filter
    if (status && Object.values(SubscriberStatus).includes(status)) {
      where.status = status;
    }

    // Apply optedIn filter
    if (optedInQuery === "true") {
      where.optedIn = true;
    } else if (optedInQuery === "false") {
      where.optedIn = false;
    }

    // Ensure valid sort fields
    const validSortFields = ["name", "phoneNumber", "status", "optedIn", "createdAt", "updatedAt"];
    const orderByField = validSortFields.includes(sortBy) ? sortBy : "createdAt";

    // Run count and query in parallel
    const [subscribers, total] = await Promise.all([
      prisma.subscriber.findMany({
        where,
        orderBy: { [orderByField]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.subscriber.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    // Mask phone numbers for VIEWERs
    const safeSubscribers = isViewer
      ? subscribers.map((s) => ({ ...s, phoneNumber: maskPhone(s.phoneNumber) }))
      : subscribers;

    res.status(200).json({
      success: true,
      data: {
        subscribers: safeSubscribers,
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getSubscriberById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      throw new BadRequestError("Invalid subscriber ID");
    }

    const subscriber = await prisma.subscriber.findUnique({
      where: { id },
    });

    if (!subscriber) {
      throw new NotFoundError("Subscriber not found");
    }

    // Mask phone for VIEWERs
    const safeSubscriber =
      req.admin?.role === "VIEWER"
        ? { ...subscriber, phoneNumber: maskPhone(subscriber.phoneNumber) }
        : subscriber;

    res.status(200).json({
      success: true,
      data: safeSubscriber,
    });
  } catch (error) {
    next(error);
  }
};

export const createSubscriber = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const validated = createSubscriberSchema.parse(req.body);

    // Check for duplicate phone number
    const existing = await prisma.subscriber.findUnique({
      where: { phoneNumber: validated.phoneNumber },
    });

    if (existing) {
      throw new ConflictError("A subscriber with this phone number already exists");
    }

    // Set business logic dates
    let optedIn = validated.optedIn;
    let optedInAt: Date | null = null;
    let unsubscribedAt: Date | null = null;

    if (validated.status === SubscriberStatus.ACTIVE) {
      optedIn = true;
      optedInAt = new Date();
    } else if (validated.status === SubscriberStatus.UNSUBSCRIBED) {
      optedIn = false;
      unsubscribedAt = new Date();
    } else if (validated.status === SubscriberStatus.BLOCKED) {
      optedIn = false;
    }

    const subscriber = await prisma.subscriber.create({
      data: {
        name: validated.name,
        phoneNumber: validated.phoneNumber,
        status: validated.status,
        optedIn,
        optedInAt,
        unsubscribedAt,
      },
    });

    res.status(201).json({
      success: true,
      data: subscriber,
    });
  } catch (error) {
    next(error);
  }
};

export const updateSubscriber = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      throw new BadRequestError("Invalid subscriber ID");
    }

    const validated = updateSubscriberSchema.parse(req.body);

    // Check if subscriber exists
    const subscriber = await prisma.subscriber.findUnique({
      where: { id },
    });

    if (!subscriber) {
      throw new NotFoundError("Subscriber not found");
    }

    // Check duplicate phone if being updated
    if (validated.phoneNumber && validated.phoneNumber !== subscriber.phoneNumber) {
      const existing = await prisma.subscriber.findUnique({
        where: { phoneNumber: validated.phoneNumber },
      });
      if (existing) {
        throw new ConflictError("A subscriber with this phone number already exists");
      }
    }

    // Prepare update data incorporating business logic
    const updateData: Prisma.SubscriberUpdateInput = {
      name: validated.name !== undefined ? validated.name : subscriber.name,
      phoneNumber: validated.phoneNumber !== undefined ? validated.phoneNumber : subscriber.phoneNumber,
    };

    let newStatus = validated.status ?? subscriber.status;
    let newOptedIn = validated.optedIn ?? subscriber.optedIn;
    let optedInAt = subscriber.optedInAt;
    let unsubscribedAt = subscriber.unsubscribedAt;

    // If status changed
    if (validated.status !== undefined && validated.status !== subscriber.status) {
      if (validated.status === SubscriberStatus.ACTIVE) {
        newOptedIn = true;
        optedInAt = new Date();
        unsubscribedAt = null;
      } else if (validated.status === SubscriberStatus.UNSUBSCRIBED) {
        newOptedIn = false;
        unsubscribedAt = new Date();
      } else if (validated.status === SubscriberStatus.BLOCKED) {
        newOptedIn = false;
      }
    }
    // If optedIn changed explicitly (without status changing explicitly)
    else if (validated.optedIn !== undefined && validated.optedIn !== subscriber.optedIn) {
      if (validated.optedIn) {
        newStatus = SubscriberStatus.ACTIVE;
        optedInAt = new Date();
        unsubscribedAt = null;
      } else {
        newStatus = SubscriberStatus.UNSUBSCRIBED;
        unsubscribedAt = new Date();
      }
    }

    updateData.status = newStatus;
    updateData.optedIn = newOptedIn;
    updateData.optedInAt = optedInAt;
    updateData.unsubscribedAt = unsubscribedAt;

    const updatedSubscriber = await prisma.subscriber.update({
      where: { id },
      data: updateData,
    });

    res.status(200).json({
      success: true,
      data: updatedSubscriber,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteSubscriber = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      throw new BadRequestError("Invalid subscriber ID");
    }

    const subscriber = await prisma.subscriber.findUnique({
      where: { id },
    });

    if (!subscriber) {
      throw new NotFoundError("Subscriber not found");
    }

    await prisma.subscriber.delete({
      where: { id },
    });

    res.status(200).json({
      success: true,
      message: "Subscriber deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};
