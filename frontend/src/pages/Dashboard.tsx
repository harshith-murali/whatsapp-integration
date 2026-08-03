import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/index.js";
import { useAuth } from "../context/AuthContext.js";
import { hasPermission } from "../utils/permissions.js";
import { AnimatedBackground } from "../components/core/animated-background.js";
import { BorderTrail } from "../components/core/border-trail.js";
import {
  Users,
  UserX,
  UserMinus,
  ShieldAlert,
  CheckSquare,
  Plus,
  UserCheck,
  Megaphone,
  Inbox,
  Clock,
  ThumbsUp,
  PlaySquare,
  ArrowRight,
  AlertCircle,
  Cpu,
} from "lucide-react";

interface DashboardData {
  totalAdmins?: number | null;
  activeAdmins?: number | null;
  totalSubscribers: number;
  activeSubscribers: number;
  unsubscribedSubscribers: number;
  blockedSubscribers: number;
  optedInSubscribers: number;
  
  // Broadcast stats
  totalBroadcasts?: number;
  draftBroadcasts?: number;
  pendingApprovalBroadcasts?: number;
  approvedBroadcasts?: number;
  queuedBroadcasts?: number;
  cancelledBroadcasts?: number;
  recentBroadcasts?: Array<{
    id: number;
    title: string;
    message: string;
    status: string;
    audienceType: string;
    totalRecipients: number;
    createdAt: string;
    createdBy: { name: string };
    group: { name: string } | null;
  }>;
  recentSubscribers: Array<{
    id: number;
    name: string | null;
    phoneNumber: string;
    status: string;
    optedIn: boolean;
    createdAt: string;
  }>;

  // Phase 3 stats additions (Admin/Super Admin)
  queuedMessages?: number;
  processingMessages?: number;
  submittedMessages?: number;
  failedMessages?: number;
  waitingRetryMessages?: number;
  activeWorkers?: number;
  recentFailures?: Array<{
    id: number;
    broadcastId: number;
    broadcastTitle: string;
    subscriberName: string | null;
    phoneNumber: string;
    failedAt: string;
    errorCode: string;
    errorMessage: string;
  }>;
  broadcastProcessingSummary?: Array<{
    id: number;
    title: string;
    status: string;
    totalRecipients: number;
    QUEUED: number;
    PROCESSING: number;
    SUBMITTED: number;
    FAILED: number;
    CANCELLED: number;
  }>;

  // Operator specific counts
  myDrafts?: number | null;
  myPendingApprovalBroadcasts?: number | null;
  mySubmittedMessages?: number;
  myFailedMessages?: number;
  myBroadcastsProgress?: Array<{
    id: number;
    title: string;
    status: string;
    totalRecipients: number;
    QUEUED: number;
    PROCESSING: number;
    SUBMITTED: number;
    FAILED: number;
    CANCELLED: number;
  }>;
}

const getErrorMessage = (error: unknown, fallback: string) => {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof error.response === "object" &&
    error.response !== null &&
    "data" in error.response &&
    typeof error.response.data === "object" &&
    error.response.data !== null &&
    "message" in error.response.data &&
    typeof error.response.data.message === "string"
  ) {
    return error.response.data.message;
  }
  return fallback;
};

export const Dashboard: React.FC = () => {
  const { admin } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const response = await api.get("/dashboard/summary");
      if (response.data?.success) {
        setData(response.data.data);
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to load dashboard metrics."));
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  // Polling loop: poll dashboard every 5s if there is active queuing/processing going on
  useEffect(() => {
    if (!data) return;

    const hasActiveProcessing =
      (data.broadcastProcessingSummary && data.broadcastProcessingSummary.length > 0) ||
      (data.myBroadcastsProgress && data.myBroadcastsProgress.length > 0) ||
      (data.processingMessages && data.processingMessages > 0);

    if (!hasActiveProcessing) return;

    let intervalId: any;

    const handleVisibility = () => {
      if (document.hidden) {
        clearInterval(intervalId);
      } else {
        clearInterval(intervalId);
        intervalId = setInterval(() => fetchSummary(true), 5000);
      }
    };

    intervalId = setInterval(() => fetchSummary(true), 5000);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [data]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl bg-red-50 p-6 text-red-700 dark:bg-red-950/30 dark:text-red-400 border border-red-100 dark:border-red-900/50">
        <p className="font-semibold">Error Loading Dashboard</p>
        <p className="text-sm mt-1">{error || "An unexpected error occurred."}</p>
      </div>
    );
  }

  const isSuperAdmin = admin?.role === "SUPER_ADMIN";
  const isOperator = admin?.role === "OPERATOR";

  // Widget segment visibility flags driven by permissions
  const canViewAdmins = hasPermission(admin?.role, "admins.view");
  const canViewBroadcastMetrics = hasPermission(admin?.role, "dashboard.broadcastMetrics");
  const canViewOperatorMetrics = hasPermission(admin?.role, "dashboard.operatorMetrics");
  const canViewRecentCampaigns = hasPermission(admin?.role, "dashboard.recentCampaigns");
  const canViewQuickActions = hasPermission(admin?.role, "dashboard.quickActions");

  // Core subscriber stats (Visible to all roles)
  const subMetrics = [
    { name: "Total Subscribers", value: data.totalSubscribers.toLocaleString(), icon: Users },
    { name: "Active Subscribers", value: data.activeSubscribers.toLocaleString(), icon: Users },
    { name: "Unsubscribed", value: data.unsubscribedSubscribers.toLocaleString(), icon: UserMinus },
    { name: "Blocked Users", value: data.blockedSubscribers.toLocaleString(), icon: UserX },
    { name: "Opted In", value: data.optedInSubscribers.toLocaleString(), icon: CheckSquare },
  ];

  // Core broadcast campaign stats (Visible to SUPER_ADMIN, ADMIN)
  const bcMetrics = [
    { name: "Total Campaigns", value: (data.totalBroadcasts ?? 0).toLocaleString(), icon: Megaphone },
    { name: "Drafts", value: (data.draftBroadcasts ?? 0).toLocaleString(), icon: Inbox },
    { name: "Pending Approval", value: (data.pendingApprovalBroadcasts ?? 0).toLocaleString(), icon: Clock },
    { name: "Approved", value: (data.approvedBroadcasts ?? 0).toLocaleString(), icon: ThumbsUp },
  ];

  // Phase 3 Delivery stats (Visible to SUPER_ADMIN, ADMIN)
  const engineMetrics = [
    { name: "Queued Messages", value: (data.queuedMessages ?? 0).toLocaleString(), icon: MessageSquareIcon },
    { name: "Processing Messages", value: (data.processingMessages ?? 0).toLocaleString(), icon: PlaySquare, isPulse: (data.processingMessages ?? 0) > 0 },
    { name: "Submitted Messages", value: (data.submittedMessages ?? 0).toLocaleString(), icon: ThumbsUp },
    { name: "Failed Messages", value: (data.failedMessages ?? 0).toLocaleString(), icon: AlertCircle, isAlert: (data.failedMessages ?? 0) > 0 },
    { name: "Retry Queue", value: (data.waitingRetryMessages ?? 0).toLocaleString(), icon: Clock },
    { name: "Active Workers", value: (data.activeWorkers ?? 0).toLocaleString(), icon: Cpu, isGreen: (data.activeWorkers ?? 0) > 0 },
  ];

  // Operator-specific metrics (Visible to OPERATOR only)
  const opMetrics = [
    { name: "My Drafts", value: (data.myDrafts ?? 0).toLocaleString(), icon: Inbox },
    { name: "My Pending Approval", value: (data.myPendingApprovalBroadcasts ?? 0).toLocaleString(), icon: Clock },
    { name: "My Submitted Messages", value: (data.mySubmittedMessages ?? 0).toLocaleString(), icon: ThumbsUp },
    { name: "My Failed Messages", value: (data.myFailedMessages ?? 0).toLocaleString(), icon: AlertCircle, isAlert: (data.myFailedMessages ?? 0) > 0 },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "DRAFT":
        return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700";
      case "PENDING_APPROVAL":
        return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/60";
      case "APPROVED":
        return "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-800/60";
      case "REJECTED":
        return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/60";
      case "QUEUED":
        return "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-400 dark:border-cyan-800/60";
      case "PROCESSING":
        return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800/60 animate-pulse";
      case "COMPLETED":
        return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60";
      case "PARTIALLY_FAILED":
        return "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-800/60";
      case "FAILED":
        return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/60";
      case "CANCELLED":
        return "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-700";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700";
    }
  };

  const MetricCard = ({
    name,
    value,
    icon: Icon,
    tone = "indigo",
    pulse = false,
  }: {
    name: string;
    value: string;
    icon: React.ComponentType<{ className?: string }>;
    tone?: "indigo" | "rose" | "emerald";
    pulse?: boolean;
  }) => {
    const toneClass =
      tone === "rose"
        ? "bg-rose-50 text-rose-650 dark:bg-rose-950/30 dark:text-rose-400"
        : tone === "emerald"
          ? "bg-emerald-50 text-emerald-650 dark:bg-emerald-950/30 dark:text-emerald-400"
          : "bg-indigo-50 text-indigo-650 dark:bg-indigo-950/30 dark:text-indigo-350";

    return (
      <div
        data-id={name}
        className="group flex h-full min-h-32 flex-col justify-between rounded-lg border border-white/80 bg-white/90 p-5 shadow-xs transition-transform duration-300 hover:-translate-y-0.5 dark:border-tail-dark-border/70 dark:bg-tail-dark-card/90"
      >
        <BorderTrail />
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-lg ${toneClass} ${
            pulse ? "animate-pulse" : ""
          }`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="mt-4">
          <span className="block text-xs font-semibold text-slate-455 dark:text-slate-500">
            {name}
          </span>
          <strong className="mt-1 block font-mono text-2xl font-bold text-slate-900 dark:text-white">
            {value}
          </strong>
        </div>
      </div>
    );
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-7 animate-fade-in">
      {/* SUPER ADMIN admin accounts header row */}
      {canViewAdmins && data.totalAdmins !== undefined && data.totalAdmins !== null && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="flex justify-between items-center bg-indigo-600 text-white rounded-lg p-5 shadow-xs">
            <div>
              <p className="text-xs uppercase font-semibold tracking-wider text-indigo-150">Total Admins Count</p>
              <h4 className="text-3xl font-bold mt-1">{data.totalAdmins}</h4>
            </div>
            <ShieldAlert className="h-10 w-10 text-indigo-200" />
          </div>
          <div className="flex justify-between items-center bg-slate-800 text-white rounded-lg p-5 shadow-xs dark:bg-tail-dark-card dark:border dark:border-tail-dark-border">
            <div>
              <p className="text-xs uppercase font-semibold tracking-wider text-slate-400">Active Admins Count</p>
              <h4 className="text-3xl font-bold mt-1">{data.activeAdmins}</h4>
            </div>
            <ShieldAlert className="h-10 w-10 text-slate-550" />
          </div>
        </div>
      )}

      {/* Subscriber Statistics section */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-450 mb-3">Subscriber Metrics</h3>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <AnimatedBackground
            className="rounded-lg bg-indigo-50/60 dark:bg-indigo-950/20"
            enableHover
          >
            {subMetrics.map((metric) => (
              <MetricCard key={metric.name} {...metric} />
            ))}
          </AnimatedBackground>
        </div>
      </div>

      {/* Campaign Statistics section (ADMIN, SUPER_ADMIN) */}
      {canViewBroadcastMetrics && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-450 mb-3">Campaign Statistics</h3>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <AnimatedBackground
              className="rounded-lg bg-indigo-50/60 dark:bg-indigo-950/20"
              enableHover
            >
              {bcMetrics.map((metric) => (
                <MetricCard key={metric.name} {...metric} />
              ))}
            </AnimatedBackground>
          </div>
        </div>
      )}

      {/* Queue & Worker Engine status section (ADMIN, SUPER_ADMIN) */}
      {canViewBroadcastMetrics && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-455 mb-3">Live Queue & Worker Engine</h3>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <AnimatedBackground
              className="rounded-lg bg-indigo-50/60 dark:bg-indigo-950/20"
              enableHover
            >
              {engineMetrics.map((metric) => (
                <MetricCard
                  key={metric.name}
                  {...metric}
                  tone={metric.isAlert ? "rose" : metric.isGreen ? "emerald" : "indigo"}
                  pulse={metric.isPulse}
                />
              ))}
            </AnimatedBackground>
          </div>
        </div>
      )}

      {/* Operator Workload stats section (OPERATOR) */}
      {canViewOperatorMetrics && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-450 mb-3">My Workspace Statistics</h3>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <AnimatedBackground
              className="rounded-lg bg-indigo-50/60 dark:bg-indigo-950/20"
              enableHover
            >
              {opMetrics.map((metric) => (
                <MetricCard
                  key={metric.name}
                  {...metric}
                  tone={metric.isAlert ? "rose" : "emerald"}
                />
              ))}
            </AnimatedBackground>
          </div>
        </div>
      )}

      {/* Active Broadcast Progress lists (Admin/Super Admin & Operator) */}
      {((data.broadcastProcessingSummary && data.broadcastProcessingSummary.length > 0) ||
        (data.myBroadcastsProgress && data.myBroadcastsProgress.length > 0)) && (
        <div className="rounded-lg border border-white/80 bg-white/95 p-6 shadow-xs dark:border-tail-dark-border/70 dark:bg-tail-dark-card/95">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider text-slate-450 mb-4 pb-2 border-b border-tail-border dark:border-tail-dark-border">
            Active Campaign Queue Progress
          </h3>
          <div className="space-y-5">
            {(isOperator ? data.myBroadcastsProgress : data.broadcastProcessingSummary)!.map((b) => {
              const completed = b.SUBMITTED + b.FAILED + b.CANCELLED;
              const percent = b.totalRecipients > 0 ? Math.round((completed / b.totalRecipients) * 100) : 0;
              return (
                <div key={b.id} className="space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <div>
                      <Link to={`/broadcasts/${b.id}`} className="font-bold text-slate-900 dark:text-white hover:underline">
                        {b.title} (#{b.id})
                      </Link>
                      <span className={`ml-2.5 inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold border uppercase ${getStatusBadge(b.status)}`}>
                        {b.status}
                      </span>
                    </div>
                    <span className="font-mono text-slate-500">
                      {completed} / {b.totalRecipients} ({percent}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div className="bg-indigo-600 h-2 rounded-full transition-all duration-300" style={{ width: `${percent}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick Actions (only visible to role permission groups) */}
      {canViewQuickActions && (
        <div className="rounded-lg border border-white/80 bg-white/95 p-6 shadow-xs dark:border-tail-dark-border/70 dark:bg-tail-dark-card/95">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider text-slate-450 mb-4 pb-2 border-b border-tail-border dark:border-tail-dark-border">
            Quick Actions
          </h3>
          <div className="flex flex-wrap gap-4">
            {hasPermission(admin?.role, "subscribers.create") && (
              <Link
                to="/subscribers?add=true"
                className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Add Subscriber
              </Link>
            )}

            {hasPermission(admin?.role, "broadcasts.create") && (
              <Link
                to="/broadcasts"
                className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer"
              >
                <Megaphone className="h-4 w-4 mr-1.5" />
                Create Broadcast
              </Link>
            )}

            {isSuperAdmin ? (
              <Link
                to="/admins"
                className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors cursor-pointer dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-white"
              >
                <UserCheck className="h-4 w-4 mr-1.5" />
                Manage Admins
              </Link>
            ) : (
              <Link
                to="/subscribers"
                className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors cursor-pointer dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-white"
              >
                <ArrowRight className="h-4 w-4 mr-1.5" />
                Manage Subscribers
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Grid: Recent Campaigns / Failures + Recent Subscribers list */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Broadcasts - Hidden entirely for OPERATOR and VIEWER roles */}
        {canViewRecentCampaigns && data.recentBroadcasts !== undefined && (
          <div className="lg:col-span-2 space-y-6">
            {/* Recent Campaigns table */}
            <div className="overflow-hidden rounded-lg border border-white/80 bg-white/95 shadow-xs dark:border-tail-dark-border/70 dark:bg-tail-dark-card/95">
              <div className="border-b border-tail-border/70 px-5 py-4 dark:border-tail-dark-border/70 flex justify-between items-center">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider text-slate-450">
                  Recent Campaigns
                </h3>
                <Link to="/broadcasts" className="text-xs font-bold text-indigo-650 hover:underline">
                  View All
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/40 text-slate-455 uppercase font-semibold border-b border-tail-border dark:border-tail-dark-border">
                      <th className="px-5 py-3">Title</th>
                      <th className="px-5 py-3">Audience</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3 text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-tail-border dark:divide-tail-dark-border">
                    {data.recentBroadcasts.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-5 py-8 text-center text-slate-400 italic">No campaigns found.</td>
                      </tr>
                    ) : (
                      data.recentBroadcasts.map((bc) => (
                        <tr key={bc.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-800/10 transition-colors">
                          <td className="px-5 py-4 font-bold text-slate-900 dark:text-white">
                            <Link to={`/broadcasts/${bc.id}`} className="hover:text-indigo-650 hover:underline">
                              {bc.title}
                            </Link>
                          </td>
                          <td className="px-5 py-4 text-slate-550">
                            {bc.audienceType === "GROUP" ? `Group: ${bc.group?.name}` : "All Active Subscribers"}
                          </td>
                          <td className="px-5 py-4">
                            <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold border uppercase ${getStatusBadge(bc.status)}`}>
                              {bc.status}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right text-slate-400">
                            {new Date(bc.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent Processing Failures list */}
            {data.recentFailures && data.recentFailures.length > 0 && (
              <div className="overflow-hidden rounded-lg border border-white/80 bg-white/95 shadow-xs dark:border-tail-dark-border/70 dark:bg-tail-dark-card/95">
                <div className="border-b border-tail-border/70 px-5 py-4 dark:border-tail-dark-border/70 flex justify-between items-center">
                  <h3 className="text-sm font-bold text-slate-950 dark:text-white uppercase tracking-wider text-rose-600">
                    Recent Processing Failures
                  </h3>
                  <Link to="/messages?status=FAILED" className="text-xs font-bold text-rose-600 hover:underline">
                    View Queue Logs
                  </Link>
                </div>
                <div className="p-4 space-y-3 text-xs">
                  {data.recentFailures.map((fail) => (
                    <div key={fail.id} className="flex justify-between items-start p-3 bg-rose-50/50 dark:bg-rose-950/10 rounded border border-rose-100/70 dark:border-rose-900/30">
                      <div>
                        <div className="font-bold text-slate-800 dark:text-slate-200">
                          {fail.subscriberName || "Subscriber"} ({fail.phoneNumber})
                        </div>
                        <div className="text-slate-450 mt-0.5">
                          Campaign: <span className="font-semibold">{fail.broadcastTitle}</span>
                        </div>
                        <div className="text-rose-600/90 font-mono text-[10px] mt-1">
                          {fail.errorCode}: {fail.errorMessage}
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-400 whitespace-nowrap">
                        {new Date(fail.failedAt).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Recent Subscribers List card - Stretches dynamically to full width when campaigns are hidden */}
        <div className={`overflow-hidden rounded-lg border border-white/80 bg-white/95 shadow-xs dark:border-tail-dark-border/70 dark:bg-tail-dark-card/95 ${
          canViewRecentCampaigns ? "lg:col-span-1" : "lg:col-span-3"
        }`}>
          <div className="border-b border-tail-border/70 px-5 py-4 dark:border-tail-dark-border/70 flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider text-slate-400">Recent Subscribers</h3>
            <Link to="/subscribers" className="text-xs font-bold text-indigo-650 hover:underline">View All</Link>
          </div>
          <div className="p-4 space-y-3">
            {data.recentSubscribers.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-6">No subscribers found.</p>
            ) : (
              data.recentSubscribers.map((sub) => (
                <div key={sub.id} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/30 rounded border border-slate-100 dark:border-tail-dark-border/40 text-xs">
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200 block">{sub.name || "(No Name)"}</span>
                    <span className="font-mono text-slate-450 mt-0.5 block">{sub.phoneNumber}</span>
                  </div>
                  <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                    sub.status === "ACTIVE"
                      ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20"
                      : "bg-rose-50 text-rose-600"
                  }`}>
                    {sub.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Local custom message square icon helper
const MessageSquareIcon = ({ className }: { className?: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
};
export default Dashboard;
