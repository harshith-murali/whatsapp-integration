import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  Bell,
  CheckCircle2,
  Database,
  KeyRound,
  MessageSquareText,
  RefreshCw,
  Server,
  ShieldCheck,
  Smartphone,
  Webhook,
} from "lucide-react";
import { api } from "../api/index.js";
import { Button } from "../components/ui/button.js";

interface HealthDetails {
  database: string;
  providerMode: string;
  activeWorkerCount: number;
  queuedMessages: number;
  failedWebhookCount: number;
  lastValidWebhookAt: string | null;
}

interface MessageTemplate {
  id: number;
  name: string;
  language: string;
  category?: string | null;
  status: string;
  lastSyncedAt?: string | null;
  body?: string | null;
}

const formatDateTime = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "Not received yet";

const statusTone = (status?: string) => {
  const normalized = String(status || "").toUpperCase();
  if (["APPROVED", "ACTIVE", "OK", "META"].includes(normalized)) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (["PENDING", "QUEUED", "MOCK"].includes(normalized)) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  if (["FAILED", "REJECTED", "DISABLED"].includes(normalized)) {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  return "border-slate-200 bg-slate-50 text-slate-600";
};

export const Settings: React.FC = () => {
  const [health, setHealth] = useState<HealthDetails | null>(null);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const templateStats = useMemo(() => {
    const approved = templates.filter((template) => template.status === "APPROVED").length;
    const pending = templates.filter((template) => template.status === "PENDING").length;
    const rejected = templates.filter((template) => template.status === "REJECTED").length;
    const latestSync = templates
      .map((template) => template.lastSyncedAt)
      .filter(Boolean)
      .sort()
      .at(-1);

    return {
      approved,
      pending,
      rejected,
      latestSync,
      total: templates.length,
    };
  }, [templates]);

  const loadSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const [healthResponse, templateResponse] = await Promise.all([
        api.get("/health/details"),
        api.get("/templates"),
      ]);
      setHealth(healthResponse.data.data);
      setTemplates(templateResponse.data.data || []);
    } catch (err: any) {
      setError(err.response?.data?.message || "Unable to load system settings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const syncTemplates = async () => {
    setSyncing(true);
    setSyncMessage(null);
    setError(null);
    try {
      const response = await api.post(
        "/templates/sync",
        {},
        { headers: { "Idempotency-Key": window.crypto.randomUUID() } }
      );
      setSyncMessage(`Synced ${response.data.data.synced || 0} templates from Meta.`);
      await loadSettings();
    } catch (err: any) {
      setError(err.response?.data?.message || "Template sync failed.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <section className="rounded-lg border border-tail-border bg-white p-5 shadow-sm dark:border-tail-dark-border dark:bg-tail-dark-card">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Control center
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
              System Settings
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">
              Monitor WhatsApp integration health, template readiness, worker queues, and admin-only operational controls.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={health?.providerMode === "meta" ? "success" : "warning"}>
              Provider: {health?.providerMode || "checking"}
            </Badge>
            <Button
              onClick={loadSettings}
              disabled={loading}
              className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-tail-dark-border dark:bg-tail-dark-card dark:text-slate-200"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={Database}
            label="Database"
            value={health?.database || "checking"}
            detail="Readiness probe"
            tone={health?.database === "ok" ? "success" : "neutral"}
          />
          <MetricCard
            icon={Activity}
            label="Active workers"
            value={String(health?.activeWorkerCount ?? 0)}
            detail="Heartbeat within 60 seconds"
            tone={(health?.activeWorkerCount || 0) > 0 ? "success" : "warning"}
          />
          <MetricCard
            icon={MessageSquareText}
            label="Queued messages"
            value={String(health?.queuedMessages ?? 0)}
            detail="Waiting for delivery worker"
            tone={(health?.queuedMessages || 0) > 0 ? "warning" : "success"}
          />
          <MetricCard
            icon={Webhook}
            label="Webhook failures"
            value={String(health?.failedWebhookCount ?? 0)}
            detail="Events needing attention"
            tone={(health?.failedWebhookCount || 0) > 0 ? "danger" : "success"}
          />
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-rose-100 bg-rose-50 p-4 text-sm font-medium text-rose-700">
          {error}
        </div>
      )}

      {syncMessage && (
        <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">
          {syncMessage}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <section className="rounded-lg border border-tail-border bg-white p-5 shadow-sm dark:border-tail-dark-border dark:bg-tail-dark-card">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-950 dark:text-white">
                WhatsApp Template Registry
              </h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Approved templates are required before Meta broadcasts can be queued.
              </p>
            </div>
            <Button
              onClick={syncTemplates}
              disabled={syncing}
              className="h-10 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-70"
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing..." : "Sync templates"}
            </Button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-4">
            <MiniStat label="Total" value={templateStats.total} />
            <MiniStat label="Approved" value={templateStats.approved} tone="success" />
            <MiniStat label="Pending" value={templateStats.pending} tone="warning" />
            <MiniStat label="Rejected" value={templateStats.rejected} tone="danger" />
          </div>

          <div className="mt-5 overflow-hidden rounded-lg border border-slate-200 dark:border-tail-dark-border">
            <div className="grid grid-cols-[minmax(160px,1fr)_110px_110px_130px] bg-slate-50 px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
              <span>Template</span>
              <span>Language</span>
              <span>Status</span>
              <span>Last sync</span>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-tail-dark-border">
              {templates.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-slate-500">
                  No templates synced yet.
                </div>
              ) : (
                templates.slice(0, 6).map((template) => (
                  <div
                    key={template.id}
                    className="grid grid-cols-[minmax(160px,1fr)_110px_110px_130px] items-center gap-3 px-4 py-3 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900 dark:text-white">{template.name}</p>
                      <p className="truncate text-xs text-slate-500">{template.category || "Uncategorized"}</p>
                    </div>
                    <span className="font-mono text-xs text-slate-600 dark:text-slate-300">{template.language}</span>
                    <span className={`w-fit rounded-md border px-2 py-1 text-[11px] font-bold ${statusTone(template.status)}`}>
                      {template.status}
                    </span>
                    <span className="text-xs text-slate-500">{formatDateTime(template.lastSyncedAt)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {templates.length > 6 && (
            <p className="mt-3 text-xs text-slate-500">
              Showing 6 of {templates.length} synced templates.
            </p>
          )}
        </section>

        <section className="space-y-6">
          <div className="rounded-lg border border-tail-border bg-white p-5 shadow-sm dark:border-tail-dark-border dark:bg-tail-dark-card">
            <h3 className="text-lg font-bold text-slate-950 dark:text-white">
              Integration Status
            </h3>
            <div className="mt-4 space-y-3">
              <StatusRow
                icon={Server}
                title="API service"
                description="Backend API is reachable through authenticated routes."
                state={health ? "Configured" : "Checking"}
              />
              <StatusRow
                icon={Smartphone}
                title="WhatsApp provider"
                description={health?.providerMode === "meta" ? "Meta Cloud API mode is active." : "Mock provider mode is active."}
                state={health?.providerMode || "Checking"}
              />
              <StatusRow
                icon={Webhook}
                title="Last valid webhook"
                description={formatDateTime(health?.lastValidWebhookAt)}
                state={(health?.failedWebhookCount || 0) > 0 ? "Review" : "Healthy"}
              />
            </div>
          </div>

          <div className="rounded-lg border border-tail-border bg-white p-5 shadow-sm dark:border-tail-dark-border dark:bg-tail-dark-card">
            <h3 className="text-lg font-bold text-slate-950 dark:text-white">
              Security Controls
            </h3>
            <div className="mt-4 grid gap-3">
              <ControlItem icon={ShieldCheck} title="Role-based access control" text="Settings are limited to Super Admin permissions." />
              <ControlItem icon={KeyRound} title="CSRF protected mutations" text="Write requests include the app CSRF token automatically." />
              <ControlItem icon={Bell} title="Notification cleanup" text="Handled access requests are removed from unread notifications." />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

const Badge: React.FC<{ children: React.ReactNode; tone: "success" | "warning" }> = ({ children, tone }) => (
  <span
    className={`inline-flex h-10 items-center rounded-lg border px-3 text-sm font-semibold ${
      tone === "success"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : "border-amber-200 bg-amber-50 text-amber-700"
    }`}
  >
    {children}
  </span>
);

const MetricCard: React.FC<{
  icon: React.ElementType;
  label: string;
  value: string;
  detail: string;
  tone: "success" | "warning" | "danger" | "neutral";
}> = ({ icon: Icon, label, value, detail, tone }) => {
  const iconClass = {
    success: "bg-emerald-50 text-emerald-600 border-emerald-100",
    warning: "bg-amber-50 text-amber-600 border-amber-100",
    danger: "bg-rose-50 text-rose-600 border-rose-100",
    neutral: "bg-slate-50 text-slate-600 border-slate-200",
  }[tone];

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 dark:border-tail-dark-border dark:bg-slate-800/30">
      <div className="flex items-center justify-between gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${iconClass}`}>
          <Icon className="h-5 w-5" />
        </div>
        {tone === "danger" ? <AlertCircle className="h-5 w-5 text-rose-500" /> : <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
      </div>
      <p className="mt-4 text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-950 dark:text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
};

const MiniStat: React.FC<{ label: string; value: number; tone?: "success" | "warning" | "danger" }> = ({
  label,
  value,
  tone,
}) => {
  const toneClass = tone
    ? {
        success: "text-emerald-700 bg-emerald-50 border-emerald-100",
        warning: "text-amber-700 bg-amber-50 border-amber-100",
        danger: "text-rose-700 bg-rose-50 border-rose-100",
      }[tone]
    : "text-slate-700 bg-slate-50 border-slate-200";

  return (
    <div className={`rounded-lg border px-4 py-3 ${toneClass}`}>
      <p className="text-[11px] font-bold uppercase tracking-wider opacity-75">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
};

const StatusRow: React.FC<{
  icon: React.ElementType;
  title: string;
  description: string;
  state: string;
}> = ({ icon: Icon, title, description, state }) => (
  <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3 dark:border-tail-dark-border dark:bg-slate-800/30">
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-indigo-100 bg-indigo-50 text-indigo-600">
      <Icon className="h-4 w-4" />
    </div>
    <div className="min-w-0 flex-1">
      <div className="flex items-start justify-between gap-3">
        <p className="font-semibold text-slate-900 dark:text-white">{title}</p>
        <span className="shrink-0 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
          {state}
        </span>
      </div>
      <p className="mt-1 text-sm leading-5 text-slate-500 dark:text-slate-400">{description}</p>
    </div>
  </div>
);

const ControlItem: React.FC<{ icon: React.ElementType; title: string; text: string }> = ({
  icon: Icon,
  title,
  text,
}) => (
  <div className="flex items-start gap-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/30">
    <Icon className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />
    <div>
      <p className="font-semibold text-slate-900 dark:text-white">{title}</p>
      <p className="mt-1 text-sm leading-5 text-slate-500 dark:text-slate-400">{text}</p>
    </div>
  </div>
);
