import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/index.js";
import { useAuth } from "../context/AuthContext.js";
import { hasPermission } from "../utils/permissions.js";
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
} from "lucide-react";

interface DashboardData {
  totalAdmins?: number | null;
  activeAdmins?: number | null;
  totalSubscribers: number;
  activeSubscribers: number;
  unsubscribedSubscribers: number;
  blockedSubscribers: number;
  optedInSubscribers: number;
  // Phase 2 statistics (optional under strict least-privilege)
  totalBroadcasts?: number;
  draftBroadcasts?: number;
  pendingApprovalBroadcasts?: number;
  approvedBroadcasts?: number;
  queuedBroadcasts?: number;
  cancelledBroadcasts?: number;
  queuedMessages?: number;
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
  myDrafts?: number | null;
  myPendingApprovalBroadcasts?: number | null;
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

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        setLoading(true);
        const response = await api.get("/dashboard/summary");
        if (response.data?.success) {
          setData(response.data.data);
        }
      } catch (err: unknown) {
        setError(getErrorMessage(err, "Failed to load dashboard metrics."));
      } finally {
        setLoading(false);
      }
    };
    fetchSummary();
  }, []);

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
    { name: "Total Broadcasts", value: (data.totalBroadcasts ?? 0).toLocaleString(), icon: Megaphone },
    { name: "Drafts", value: (data.draftBroadcasts ?? 0).toLocaleString(), icon: Inbox },
    { name: "Pending Review", value: (data.pendingApprovalBroadcasts ?? 0).toLocaleString(), icon: Clock },
    { name: "Approved", value: (data.approvedBroadcasts ?? 0).toLocaleString(), icon: ThumbsUp },
    { name: "Queued Broadcasts", value: (data.queuedBroadcasts ?? 0).toLocaleString(), icon: PlaySquare },
    { name: "Queued Messages", value: (data.queuedMessages ?? 0).toLocaleString(), icon: MessageSquareIcon },
  ];

  // Operator-specific metrics (Visible to OPERATOR only)
  const opMetrics = [
    { name: "My Drafts", value: (data.myDrafts ?? 0).toLocaleString(), icon: Inbox },
    { name: "My Pending Approval", value: (data.myPendingApprovalBroadcasts ?? 0).toLocaleString(), icon: Clock },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "DRAFT":
        return "bg-slate-100 text-slate-700 border-slate-200";
      case "PENDING_APPROVAL":
        return "bg-amber-50 text-amber-700 border-amber-250";
      case "APPROVED":
        return "bg-indigo-50 text-indigo-750 border-indigo-200";
      case "QUEUED":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "CANCELLED":
        return "bg-red-50 text-red-700 border-red-200";
      default:
        return "bg-slate-50 text-slate-600";
    }
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
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Subscriber Metrics</h3>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {subMetrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <div
                key={metric.name}
                className="flex flex-col justify-between rounded-lg border border-white/80 bg-white/95 p-5 shadow-xs dark:border-tail-dark-border/70 dark:bg-tail-dark-card/90"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-650 dark:bg-indigo-950/30 dark:text-indigo-350">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="mt-4">
                  <span className="text-xs text-slate-455 dark:text-slate-500 font-semibold block">{metric.name}</span>
                  <strong className="text-2xl font-bold text-slate-900 dark:text-white mt-1 block font-mono">{metric.value}</strong>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Campaign & Queues section (ADMIN, SUPER_ADMIN) */}
      {canViewBroadcastMetrics && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Broadcast Campaigns & Queues</h3>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {bcMetrics.map((metric) => {
              const Icon = metric.icon;
              return (
                <div
                  key={metric.name}
                  className="flex flex-col justify-between rounded-lg border border-white/80 bg-white/95 p-5 shadow-xs dark:border-tail-dark-border/70 dark:bg-tail-dark-card/90"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-650 dark:bg-emerald-950/30 dark:text-emerald-350">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="mt-4">
                    <span className="text-xs text-slate-455 dark:text-slate-500 font-semibold block">{metric.name}</span>
                    <strong className="text-2xl font-bold text-slate-900 dark:text-white mt-1 block font-mono">{metric.value}</strong>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Operator Workload stats section (OPERATOR) */}
      {canViewOperatorMetrics && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">My Workspace Statistics</h3>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-2">
            {opMetrics.map((metric) => {
              const Icon = metric.icon;
              return (
                <div
                  key={metric.name}
                  className="flex flex-col justify-between rounded-lg border border-white/80 bg-white/95 p-5 shadow-xs dark:border-tail-dark-border/70 dark:bg-tail-dark-card/90"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-650 dark:bg-emerald-950/30 dark:text-emerald-350">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="mt-4">
                    <span className="text-xs text-slate-455 dark:text-slate-500 font-semibold block">{metric.name}</span>
                    <strong className="text-2xl font-bold text-slate-900 dark:text-white mt-1 block font-mono">{metric.value}</strong>
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
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider text-slate-400 mb-4 pb-2 border-b border-tail-border dark:border-tail-dark-border">
            Quick Actions
          </h3>
          <div className="flex flex-wrap gap-4">
            {hasPermission(admin?.role, "subscribers.create") && (
              <Link
                to="/subscribers?add=true"
                className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-indigo-650 hover:bg-indigo-700 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer"
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

      {/* Grid: Recent Broadcasts + Recent Subscribers list (Clean reflow grid columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Broadcasts - Hidden entirely for OPERATOR and VIEWER roles */}
        {canViewRecentCampaigns && data.recentBroadcasts !== undefined && (
          <div className="lg:col-span-2 overflow-hidden rounded-lg border border-white/80 bg-white/95 shadow-xs dark:border-tail-dark-border/70 dark:bg-tail-dark-card/95">
            <div className="border-b border-tail-border/70 px-5 py-4 dark:border-tail-dark-border/70 flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider text-slate-400">
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
