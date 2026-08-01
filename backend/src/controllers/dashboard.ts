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

    // Gather basic stats
    const [
      totalSubscribers,
      activeSubscribers,
      unsubscribedSubscribers,
      blockedSubscribers,
      optedInSubscribers,
      totalAdmins,
      activeAdmins,
      recentSubscribers,
      totalBroadcasts,
      draftBroadcasts,
      pendingApprovalBroadcasts,
      approvedBroadcasts,
      queuedBroadcasts,
      cancelledBroadcasts,
      recentBroadcasts,
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
      // Broadcast stats (if Admin or Super Admin)
      isAdmin ? prisma.broadcast.count() : Promise.resolve(0),
      isAdmin ? prisma.broadcast.count({ where: { status: BroadcastStatus.DRAFT } }) : Promise.resolve(0),
      isAdmin ? prisma.broadcast.count({ where: { status: BroadcastStatus.PENDING_APPROVAL } }) : Promise.resolve(0),
      isAdmin ? prisma.broadcast.count({ where: { status: BroadcastStatus.APPROVED } }) : Promise.resolve(0),
      isAdmin ? prisma.broadcast.count({ where: { status: BroadcastStatus.QUEUED } }) : Promise.resolve(0),
      isAdmin ? prisma.broadcast.count({ where: { status: BroadcastStatus.CANCELLED } }) : Promise.resolve(0),
      // Recent Broadcasts
      prisma.broadcast.findMany({
        where: broadcastFilter,
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          createdBy: { select: { name: true } },
          group: { select: { name: true } },
        },
      }),
      // Operator specific drafts
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

    if (isAdmin) {
      // 1. Gather Phase 3 message metrics
      const [
        queuedMessages,
        processingMessages,
        submittedMessages,
        failedMessages,
        waitingRetryMessages,
        activeWorkersCount,
        recentFailuresRaw,
        activeBroadcastsRaw,
      ] = await Promise.all([
        prisma.message.count({ where: { status: MessageStatus.QUEUED } }),
        prisma.message.count({ where: { status: MessageStatus.PROCESSING } }),
        prisma.message.count({ where: { status: MessageStatus.SUBMITTED } }),
        prisma.message.count({ where: { status: MessageStatus.FAILED } }),
        prisma.message.count({ where: { status: MessageStatus.QUEUED, retryCount: { gt: 0 } } }),
        prisma.workerHeartbeat.count({ where: { lastHeartbeatAt: { gte: new Date(Date.now() - 15000) } } }),
        prisma.message.findMany({
          where: { status: MessageStatus.FAILED },
          orderBy: { failedAt: "desc" },
          take: 5,
          include: {
            subscriber: { select: { name: true, phoneNumber: true } },
            broadcast: { select: { title: true } },
          },
        }),
        prisma.broadcast.findMany({
          where: { status: { in: [BroadcastStatus.QUEUED, BroadcastStatus.PROCESSING] } },
          select: {
            id: true,
            title: true,
            status: true,
            totalRecipients: true,
            messages: { select: { status: true } },
          },
        }),
      ]);

      const recentFailures = recentFailuresRaw.map((f) => ({
        id: f.id,
        broadcastId: f.broadcastId,
        broadcastTitle: f.broadcast.title,
        subscriberName: f.subscriber.name,
        phoneNumber: maskPhone(f.subscriber.phoneNumber),
        failedAt: f.failedAt,
        errorCode: f.errorCode,
        errorMessage: f.errorMessage,
      }));

      const broadcastProcessingSummary = activeBroadcastsRaw.map((b) => {
        const counts = { QUEUED: 0, PROCESSING: 0, SUBMITTED: 0, FAILED: 0, CANCELLED: 0 };
        for (const m of b.messages) {
          if (counts[m.status as keyof typeof counts] !== undefined) {
            counts[m.status as keyof typeof counts]++;
          }
        }
        return {
          id: b.id,
          title: b.title,
          status: b.status,
          totalRecipients: b.totalRecipients,
          ...counts,
        };
      });

      responseData = {
        ...responseData,
        totalBroadcasts,
        draftBroadcasts,
        pendingApprovalBroadcasts,
        approvedBroadcasts,
        queuedBroadcasts,
        cancelledBroadcasts,
        recentBroadcasts,
        // Phase 3 Metrics
        queuedMessages,
        processingMessages,
        submittedMessages,
        failedMessages,
        waitingRetryMessages,
        activeWorkers: activeWorkersCount,
        recentFailures,
        broadcastProcessingSummary,
      };

      if (isSuperAdmin) {
        responseData.totalAdmins = totalAdmins;
        responseData.activeAdmins = activeAdmins;
      }
    } else if (isOperator) {
      // Operator stats
      const [
        mySubmittedMessages,
        myFailedMessages,
        myBroadcastsProgressRaw,
      ] = await Promise.all([
        prisma.message.count({ where: { status: MessageStatus.SUBMITTED, broadcast: { createdById: adminId } } }),
        prisma.message.count({ where: { status: MessageStatus.FAILED, broadcast: { createdById: adminId } } }),
        prisma.broadcast.findMany({
          where: { createdById: adminId, status: { in: [BroadcastStatus.QUEUED, BroadcastStatus.PROCESSING] } },
          select: {
            id: true,
            title: true,
            status: true,
            totalRecipients: true,
            messages: { select: { status: true } },
          },
        }),
      ]);

      const myBroadcastsProgress = myBroadcastsProgressRaw.map((b) => {
        const counts = { QUEUED: 0, PROCESSING: 0, SUBMITTED: 0, FAILED: 0, CANCELLED: 0 };
        for (const m of b.messages) {
          if (counts[m.status as keyof typeof counts] !== undefined) {
            counts[m.status as keyof typeof counts]++;
          }
        }
        return {
          id: b.id,
          title: b.title,
          status: b.status,
          totalRecipients: b.totalRecipients,
          ...counts,
        };
      });

      responseData = {
        ...responseData,
        myDrafts,
        myPendingApprovalBroadcasts,
        mySubmittedMessages,
        myFailedMessages,
        myBroadcastsProgress,
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
