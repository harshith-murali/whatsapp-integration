import { Request, Response, NextFunction } from "express";
import { prisma } from "../config/prisma.js";
import { AdminRole, BroadcastStatus, MessageStatus } from "../generated/prisma/client.js";

export const getDashboardSummary = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const adminId = req.admin?.id;
    const adminRole = req.admin?.role;

    if (!adminId || !adminRole) {
      res.status(401).json({ success: false, message: "Unauthenticated" });
      return;
    }

    const isSuperAdmin = adminRole === AdminRole.SUPER_ADMIN;
    const isAdmin = adminRole === AdminRole.SUPER_ADMIN || adminRole === AdminRole.ADMIN;
    const isOperator = adminRole === AdminRole.OPERATOR;

    // Build the query filter for recent broadcasts visibility
    const broadcastFilter: any = {};
    if (isOperator) {
      broadcastFilter.OR = [
        { createdById: adminId },
        { status: { not: BroadcastStatus.DRAFT } },
      ];
    } else if (adminRole === AdminRole.VIEWER) {
      broadcastFilter.status = { not: BroadcastStatus.DRAFT };
    }

    // Run parallel queries to gather stats
    const [
      totalSubscribers,
      activeSubscribers,
      unsubscribedSubscribers,
      blockedSubscribers,
      optedInSubscribers,
      totalAdmins,
      activeAdmins,
      recentSubscribers,
      // Phase 2 statistics
      totalBroadcasts,
      draftBroadcasts,
      pendingApprovalBroadcasts,
      approvedBroadcasts,
      queuedBroadcasts,
      cancelledBroadcasts,
      queuedMessages,
      recentBroadcasts,
      // Operator specific drafts
      myDrafts,
      myPendingApprovalBroadcasts,
    ] = await Promise.all([
      // Subscribers counts
      prisma.subscriber.count(),
      prisma.subscriber.count({ where: { status: "ACTIVE" } }),
      prisma.subscriber.count({ where: { status: "UNSUBSCRIBED" } }),
      prisma.subscriber.count({ where: { status: "BLOCKED" } }),
      prisma.subscriber.count({ where: { optedIn: true, status: "ACTIVE" } }),
      // Admin counts (Super Admin only)
      isSuperAdmin ? prisma.admin.count() : Promise.resolve(null),
      isSuperAdmin ? prisma.admin.count({ where: { isActive: true } }) : Promise.resolve(null),
      // Recent Subscribers
      prisma.subscriber.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          name: true,
          phoneNumber: true,
          status: true,
          optedIn: true,
          createdAt: true,
        },
      }),
      prisma.broadcast.count(isOperator ? { where: { createdById: adminId } } : undefined),
      prisma.broadcast.count({ where: { status: BroadcastStatus.DRAFT } }),
      prisma.broadcast.count({ where: { status: BroadcastStatus.PENDING_APPROVAL } }),
      prisma.broadcast.count({ where: { status: BroadcastStatus.APPROVED } }),
      prisma.broadcast.count({ where: { status: BroadcastStatus.QUEUED } }),
      prisma.broadcast.count({ where: { status: BroadcastStatus.CANCELLED } }),
      prisma.message.count({ where: { status: MessageStatus.QUEUED } }),
      // Recent Broadcasts list (up to 5)
      prisma.broadcast.findMany({
        where: broadcastFilter,
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          createdBy: { select: { name: true } },
          group: { select: { name: true } },
        },
      }),
      // Operator counts
      isOperator ? prisma.broadcast.count({ where: { createdById: adminId, status: BroadcastStatus.DRAFT } }) : Promise.resolve(null),
      isOperator ? prisma.broadcast.count({ where: { createdById: adminId, status: BroadcastStatus.PENDING_APPROVAL } }) : Promise.resolve(null),
    ]);

    const maskPhone = (phone: string): string => {
      if (phone.length <= 4) return "••••";
      return phone.slice(0, -4).replace(/./g, "•") + phone.slice(-4);
    };

    const formattedRecentSubscribers = recentSubscribers.map((s) => ({
      ...s,
      phoneNumber: adminRole === AdminRole.VIEWER ? maskPhone(s.phoneNumber) : s.phoneNumber,
    }));

    let responseData: any = {
      totalSubscribers,
      activeSubscribers,
      unsubscribedSubscribers,
      blockedSubscribers,
      optedInSubscribers,
      recentSubscribers: formattedRecentSubscribers,
    };

    if (adminRole === AdminRole.SUPER_ADMIN) {
      responseData = {
        ...responseData,
        totalAdmins,
        activeAdmins,
        totalBroadcasts,
        draftBroadcasts,
        pendingApprovalBroadcasts,
        approvedBroadcasts,
        queuedBroadcasts,
        cancelledBroadcasts,
        queuedMessages,
        recentBroadcasts,
      };
    } else if (adminRole === AdminRole.ADMIN) {
      responseData = {
        ...responseData,
        totalBroadcasts,
        draftBroadcasts,
        pendingApprovalBroadcasts,
        approvedBroadcasts,
        queuedBroadcasts,
        cancelledBroadcasts,
        queuedMessages,
        recentBroadcasts,
      };
    } else if (adminRole === AdminRole.OPERATOR) {
      responseData = {
        ...responseData,
        myDrafts,
        myPendingApprovalBroadcasts,
      };
    }

    res.status(200).json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    next(error);
  }
};
