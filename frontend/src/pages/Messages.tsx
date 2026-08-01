import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/index.js";
import { useAuth } from "../context/AuthContext.js";
import { SelectMenu } from "../components/ui/select-menu.js";
import { Button } from "../components/ui/button.js";
import {
  MessageSquare,
  Search,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from "lucide-react";

interface MessageLog {
  id: number;
  broadcastId: number;
  broadcastTitle: string;
  subscriberId: number;
  subscriberName: string | null;
  phoneNumber: string;
  status: string;
  errorCode: string | null;
  errorMessage: string | null;
  retryCount: number;
  maxRetries: number;
  nextRetryAt: string | null;
  lastAttemptAt: string | null;
  processingStartedAt: string | null;
  submittedAt: string | null;
  failedAt: string | null;
  cancelledAt: string | null;
  providerName: string | null;
  providerMessageId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface BroadcastOption {
  id: number;
  title: string;
}

export const Messages: React.FC = () => {
  const { admin } = useAuth();
  const [messages, setMessages] = useState<MessageLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination / Filter states
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [broadcastFilter, setBroadcastFilter] = useState("");
  const [hasErrorFilter, setHasErrorFilter] = useState(false);
  const [retryWaitingFilter, setRetryWaitingFilter] = useState(false);
  
  // Options lists
  const [broadcasts, setBroadcasts] = useState<BroadcastOption[]>([]);
  
  // Track action pending
  const [actionMessageId, setActionMessageId] = useState<number | null>(null);

  const isAdminOrSuper = admin?.role === "ADMIN" || admin?.role === "SUPER_ADMIN";
  const messageStatusOptions = [
    { value: "", label: "All Statuses" },
    { value: "QUEUED", label: "QUEUED" },
    { value: "PROCESSING", label: "PROCESSING" },
    { value: "SUBMITTED", label: "SUBMITTED" },
    { value: "FAILED", label: "FAILED" },
    { value: "CANCELLED", label: "CANCELLED" },
  ];

  // Fetch broadcasts options for select filter
  useEffect(() => {
    const fetchBroadcastOptions = async () => {
      try {
        const response = await api.get("/broadcasts?limit=100");
        if (response.data?.success) {
          setBroadcasts(
            response.data.data.broadcasts.map((b: any) => ({
              id: b.id,
              title: b.title,
            }))
          );
        }
      } catch (err) {
        console.error("Failed to load campaigns options", err);
      }
    };
    fetchBroadcastOptions();
  }, []);

  const fetchMessages = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError(null);
      let url = `/messages?page=${page}&limit=10&search=${search}`;
      if (statusFilter) url += `&status=${statusFilter}`;
      if (broadcastFilter) url += `&broadcastId=${broadcastFilter}`;
      if (hasErrorFilter) url += `&hasError=true`;
      if (retryWaitingFilter) url += `&retryable=true`;
      
      const response = await api.get(url);
      if (response.data?.success) {
        setMessages(response.data.data.messages);
        setTotalPages(response.data.data.totalPages);
        setTotal(response.data.data.total);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load message logs");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, [page, statusFilter, broadcastFilter, hasErrorFilter, retryWaitingFilter]);

  // Polling logic: poll every 5s if there is any active non-terminal processing message
  useEffect(() => {
    const hasActiveMessages = messages.some(
      (m) => m.status === "QUEUED" || m.status === "PROCESSING"
    );

    if (!hasActiveMessages) return;

    let intervalId: any;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearInterval(intervalId);
      } else {
        clearInterval(intervalId);
        intervalId = setInterval(() => fetchMessages(true), 5000);
      }
    };

    // Set poller
    intervalId = setInterval(() => fetchMessages(true), 5000);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [messages]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchMessages();
  };

  const handleRequeue = async (id: number) => {
    try {
      setActionMessageId(id);
      const response = await api.post(`/messages/${id}/requeue`);
      if (response.data?.success) {
        fetchMessages(true);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to requeue message");
    } finally {
      setActionMessageId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "QUEUED":
        return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/50";
      case "PROCESSING":
        return "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/50 animate-pulse";
      case "SUBMITTED":
        return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50";
      case "FAILED":
        return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/50";
      case "CANCELLED":
        return "bg-slate-100 text-slate-650 border-slate-200 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-800";
      default:
        return "bg-slate-50 text-slate-600";
    }
  };

  return (
    <div className="space-y-6 animate-fade-in w-full max-w-7xl mx-auto">
      {/* Title Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Message Delivery Logs
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Track individual WhatsApp delivery logs, event status queues, and failures.
          </p>
        </div>
        <Button
          onClick={() => fetchMessages()}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors dark:border-tail-dark-border dark:bg-tail-dark-card dark:text-white dark:hover:bg-slate-800 cursor-pointer"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      {/* Filter workspace */}
      <div className="bg-white p-5 rounded-lg border border-tail-border shadow-xs dark:bg-tail-dark-card dark:border-tail-dark-border">
        <form onSubmit={handleSearchSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative md:col-span-2">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Search className="h-4 w-4" />
              </span>
              <input
                type="text"
                placeholder="Search subscriber name or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="block w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-4 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-hidden dark:border-tail-dark-border dark:bg-tail-dark-bg dark:text-white"
              />
            </div>

            <div>
              <SelectMenu
                value={broadcastFilter}
                options={[
                  { value: "", label: "All Campaigns" },
                  ...broadcasts.map((broadcast) => ({
                    value: String(broadcast.id),
                    label: broadcast.title,
                  })),
                ]}
                onValueChange={(value) => {
                  setBroadcastFilter(value);
                  setPage(1);
                }}
                label="Campaign"
                contentClassName="w-72"
              />
            </div>

            <div>
              <SelectMenu
                value={statusFilter}
                options={messageStatusOptions}
                onValueChange={(value) => {
                  setStatusFilter(value);
                  setPage(1);
                }}
                label="Status"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 pt-1 text-sm">
            <label className="inline-flex items-center gap-2 cursor-pointer text-slate-650 dark:text-slate-300">
              <input
                type="checkbox"
                checked={hasErrorFilter}
                onChange={(e) => {
                  setHasErrorFilter(e.target.checked);
                  setPage(1);
                }}
                className="rounded border-slate-300 text-indigo-650 focus:ring-indigo-500 h-4 w-4 dark:border-tail-dark-border dark:bg-tail-dark-bg"
              />
              <span>Has Processing Errors</span>
            </label>

            <label className="inline-flex items-center gap-2 cursor-pointer text-slate-650 dark:text-slate-300">
              <input
                type="checkbox"
                checked={retryWaitingFilter}
                onChange={(e) => {
                  setRetryWaitingFilter(e.target.checked);
                  setPage(1);
                }}
                className="rounded border-slate-300 text-indigo-650 focus:ring-indigo-500 h-4 w-4 dark:border-tail-dark-border dark:bg-tail-dark-bg"
              />
              <span>Retry Queue Only</span>
            </label>
          </div>
        </form>
      </div>

      {/* Results grid list */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
        </div>
      ) : error ? (
        <div className="rounded-xl bg-red-50 p-6 text-red-700 dark:bg-red-950/30 dark:text-red-400 border border-red-100 dark:border-red-900/50">
          <p className="font-semibold">Failed to fetch logs</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      ) : messages.length === 0 ? (
        <div className="rounded-lg bg-white border border-tail-border p-16 text-center dark:bg-tail-dark-card dark:border-tail-dark-border">
          <MessageSquare className="h-12 w-12 text-slate-400 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-800 dark:text-white">No Message Logs</h3>
          <p className="text-sm text-slate-400 mt-2 max-w-sm mx-auto">
            Once campaign broadcasts are approved and queued, message logs will populate here.
          </p>
        </div>
      ) : (
        <div className="rounded-lg bg-white shadow-xs border border-tail-border dark:bg-tail-dark-card dark:border-tail-dark-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 uppercase font-semibold border-b border-tail-border dark:border-tail-dark-border">
                  <th className="px-5 py-4">Subscriber</th>
                  <th className="px-5 py-4">Phone Number</th>
                  <th className="px-5 py-4">Broadcast Campaign</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Retry Info</th>
                  <th className="px-5 py-4">Next Attempt</th>
                  <th className="px-5 py-4">Provider / ID</th>
                  <th className="px-5 py-4">Last Attempt</th>
                  <th className="px-5 py-4">Error details</th>
                  <th className="px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-tail-border dark:divide-tail-dark-border text-xs">
                {messages.map((msg) => (
                  <tr key={msg.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                    <td className="px-5 py-4 font-bold text-slate-900 dark:text-white">
                      {msg.subscriberName || <span className="text-slate-400 italic font-normal">No name</span>}
                    </td>
                    <td className="px-5 py-4 font-mono text-slate-600 dark:text-slate-400">
                      {msg.phoneNumber}
                    </td>
                    <td className="px-5 py-4 text-slate-700 dark:text-slate-350">
                      <Link to={`/broadcasts/${msg.broadcastId}`} className="hover:text-indigo-650 hover:underline">
                        {msg.broadcastTitle}
                      </Link>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${getStatusBadge(msg.status)}`}>
                        {msg.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-550 dark:text-slate-400 font-mono">
                      {msg.retryCount} / {msg.maxRetries}
                    </td>
                    <td className="px-5 py-4 text-slate-550 dark:text-slate-400 font-mono">
                      {msg.nextRetryAt ? new Date(msg.nextRetryAt).toLocaleTimeString() : <span className="text-slate-350">—</span>}
                    </td>
                    <td className="px-5 py-4 text-slate-500 dark:text-slate-450">
                      {msg.providerName ? (
                        <div>
                          <span className="block font-semibold">{msg.providerName}</span>
                          <span className="block text-[10px] text-slate-400 font-mono truncate max-w-[120px]" title={msg.providerMessageId || ""}>
                            {msg.providerMessageId || ""}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-350">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-slate-500 dark:text-slate-400">
                      {msg.lastAttemptAt ? new Date(msg.lastAttemptAt).toLocaleTimeString() : <span className="text-slate-350">—</span>}
                    </td>
                    <td className="px-5 py-4 text-rose-650 max-w-[180px] truncate" title={msg.errorMessage || ""}>
                      {msg.errorCode ? (
                        <div>
                          <span className="font-semibold block">{msg.errorCode}</span>
                          <span className="text-[10px] block text-rose-500/80 truncate">{msg.errorMessage}</span>
                        </div>
                      ) : (
                        <span className="text-slate-350">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {isAdminOrSuper && msg.status === "FAILED" && (
                        <Button
                          disabled={actionMessageId === msg.id}
                          onClick={() => handleRequeue(msg.id)}
                          className="inline-flex items-center justify-center px-2.5 py-1 rounded bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 font-bold text-[10px] shadow-2xs transition-colors cursor-pointer disabled:opacity-40"
                        >
                          {actionMessageId === msg.id ? "Queuing..." : "Requeue"}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {totalPages > 1 && (
            <div className="px-5 py-4 border-t border-tail-border dark:border-tail-dark-border flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Page {page} of {totalPages} ({total} message logs)
              </span>
              <div className="flex space-x-2">
                <Button
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="p-1.5 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40 cursor-pointer dark:border-tail-dark-border dark:bg-tail-dark-bg"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                  className="p-1.5 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40 cursor-pointer dark:border-tail-dark-border dark:bg-tail-dark-bg"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
export default Messages;
