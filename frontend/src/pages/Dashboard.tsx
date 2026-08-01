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
  Calendar,
  CheckSquare,
  Plus,
  UserCheck,
  ArrowRight,
} from "lucide-react";

interface DashboardData {
  totalAdmins: number | null;
  activeAdmins: number | null;
  totalSubscribers: number;
  activeSubscribers: number;
  unsubscribedSubscribers: number;
  blockedSubscribers: number;
  optedInSubscribers: number;
  recentSubscribers: Array<{
    id: number;
    name: string | null;
    phoneNumber: string;
    status: string;
    optedIn: boolean;
    createdAt: string;
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

  // Build metrics from real database counts only — no fake trends
  const metrics = [
    {
      name: "Total Subscribers",
      value: data.totalSubscribers.toLocaleString(),
      icon: Users,
      label: "All registered subscribers",
    },
    {
      name: "Active Subscribers",
      value: data.activeSubscribers.toLocaleString(),
      icon: Users,
      label: "Currently opted-in and active",
    },
    {
      name: "Unsubscribed",
      value: data.unsubscribedSubscribers.toLocaleString(),
      icon: UserMinus,
      label: "Opted out of messaging",
    },
    {
      name: "Blocked Users",
      value: data.blockedSubscribers.toLocaleString(),
      icon: UserX,
      label: "Blocked from receiving messages",
    },
    {
      name: "Opted In",
      value: data.optedInSubscribers.toLocaleString(),
      icon: CheckSquare,
      label: "Currently consented to receive messages",
    },
  ];

  // Only show Admin metrics to users authorized to manage admins
  const canViewAdmins = hasPermission(admin?.role, "admins.view");
  if (canViewAdmins && data.totalAdmins !== null) {
    metrics.push(
      {
        name: "Total Admins",
        value: data.totalAdmins.toLocaleString(),
        icon: ShieldAlert,
        label: "All admin accounts",
      },
      {
        name: "Active Admins",
        value: (data.activeAdmins || 0).toLocaleString(),
        icon: ShieldAlert,
        label: "Currently active admin accounts",
      }
    );
  }

  // Determine Quick Actions visibility (hide completely for VIEWER)
  const canAddSubscriber = hasPermission(admin?.role, "subscribers.create");
  const canManageAdmins = hasPermission(admin?.role, "admins.create");
  const showQuickActions = canAddSubscriber || canManageAdmins;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-7 animate-fade-in">
      {/* Grid Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div
              key={metric.name}
              className="group flex min-h-44 flex-col justify-between rounded-lg border border-white/80 bg-white/90 p-6 shadow-sm shadow-slate-200/70 transition duration-200 hover:-translate-y-0.5 hover:shadow-md hover:shadow-slate-200/80 dark:border-tail-dark-border/70 dark:bg-tail-dark-card/90 dark:shadow-black/10"
            >
              {/* Icon badge */}
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100 transition group-hover:bg-indigo-600 group-hover:text-white dark:bg-indigo-950/30 dark:text-indigo-300 dark:ring-indigo-900/40">
                <Icon className="h-6 w-6" />
              </div>

              {/* Real count and label */}
              <div className="mt-8">
                <h4 className="text-3xl font-bold leading-none text-slate-900 dark:text-white">
                  {metric.value}
                </h4>
                <div className="mt-3 flex flex-col gap-1.5">
                  <span className="text-base font-semibold leading-6 text-slate-600 dark:text-slate-300">
                    {metric.name}
                  </span>
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    {metric.label}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Actions (only for roles with management/mutate permissions) */}
      {showQuickActions && (
        <div className="rounded-lg border border-white/80 bg-white/95 p-6 shadow-sm shadow-slate-200/70 dark:border-tail-dark-border/70 dark:bg-tail-dark-card/95 dark:shadow-black/10">
          <div className="flex flex-col gap-1 border-b border-tail-border/70 pb-4 mb-5">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Quick Actions
            </h3>
            <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">
              Common tasks for your authorization level
            </span>
          </div>
          <div className="flex flex-wrap gap-4">
            {canAddSubscriber && (
              <Link
                to="/subscribers?add=true"
                className="inline-flex items-center justify-center px-5 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-md transition-colors cursor-pointer"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Subscriber
              </Link>
            )}

            {isSuperAdmin ? (
              <Link
                to="/admins"
                className="inline-flex items-center justify-center px-5 py-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm transition-colors cursor-pointer dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-white"
              >
                <UserCheck className="h-4 w-4 mr-2" />
                Manage Admins
              </Link>
            ) : (
              <Link
                to="/subscribers"
                className="inline-flex items-center justify-center px-5 py-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm transition-colors cursor-pointer dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-white"
              >
                <ArrowRight className="h-4 w-4 mr-2" />
                Manage Subscribers
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Recent Subscribers List */}
      <div className="overflow-hidden rounded-lg border border-white/80 bg-white/95 shadow-sm shadow-slate-200/70 dark:border-tail-dark-border/70 dark:bg-tail-dark-card/95 dark:shadow-black/10">
        <div className="flex flex-col gap-1 border-b border-tail-border/70 bg-white/80 px-5 py-5 sm:flex-row sm:items-center sm:justify-between dark:border-tail-dark-border/70 dark:bg-tail-dark-card/80">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            Recent Subscribers
          </h3>
          <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">
            Latest Signups
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 text-xs uppercase font-semibold border-b border-tail-border dark:border-tail-dark-border">
                <th className="px-5 py-4">Name</th>
                <th className="px-5 py-4">Phone Number</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Opt In</th>
                <th className="px-5 py-4 text-right">Signed Up</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-tail-border dark:divide-tail-dark-border text-sm">
              {data.recentSubscribers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-slate-400 dark:text-slate-500">
                    No subscribers found in database yet.
                  </td>
                </tr>
              ) : (
                data.recentSubscribers.map((sub) => (
                  <tr key={sub.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                    <td className="px-5 py-4 font-semibold text-slate-950 dark:text-slate-200">
                      {sub.name || <span className="text-slate-400 italic font-normal">No name provided</span>}
                    </td>
                    <td className="px-5 py-4 font-mono text-slate-600 dark:text-slate-400">
                      {admin?.role === "VIEWER" ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span>{sub.phoneNumber}</span>
                          <span
                            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-600 border border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900"
                            title="Phone numbers are masked for your role"
                          >
                            masked
                          </span>
                        </span>
                      ) : (
                        sub.phoneNumber
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          sub.status === "ACTIVE"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400"
                            : sub.status === "UNSUBSCRIBED"
                            ? "bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400"
                            : "bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400"
                        }`}
                      >
                        {sub.status}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold ${
                          sub.optedIn
                            ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/20 dark:text-indigo-400"
                            : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                        }`}
                      >
                        {sub.optedIn ? "Opted In" : "Opted Out"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-500 dark:text-slate-400">
                      <div className="flex items-center justify-end gap-1.5">
                        <Calendar className="h-4 w-4 text-slate-400" />
                        <span>{new Date(sub.createdAt).toLocaleDateString()}</span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
