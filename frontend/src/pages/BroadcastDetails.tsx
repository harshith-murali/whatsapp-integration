import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api/index.js";
import { useAuth } from "../context/AuthContext.js";
import { Button } from "../components/ui/button.js";
import {
  ArrowLeft,
  XCircle,
  Check,
  User,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from "lucide-react";

interface BroadcastDetails {
  id: number;
  title: string;
  message: string;
  category: string;
  severity: string;
  audienceType: string;
  groupId: number | null;
  status: string;
  totalRecipients: number;
  createdById: number;
  approvedById: number | null;
  rejectedById: number | null;
  rejectionReason: string | null;
  cancellationReason: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  queuedAt: string | null;
  cancelledAt: string | null;
  processingStartedAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  createdAt: string;
  createdBy: { name: string; email: string };
  approvedBy: { name: string } | null;
  rejectedBy: { name: string } | null;
  group: { name: string } | null;
  messageStats?: {
    QUEUED: number;
    PROCESSING: number;
    SUBMITTED: number;
    FAILED: number;
    CANCELLED: number;
  };
}

interface MessageLog {
  id: number;
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
  submittedAt: string | null;
  failedAt: string | null;
  createdAt: string;
}

export const BroadcastDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { admin } = useAuth();
  const [broadcast, setBroadcast] = useState<BroadcastDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination for message recipient log
  const [messages, setMessages] = useState<MessageLog[]>([]);
  const [msgPage, setMsgPage] = useState(1);
  const [msgTotalPages, setMsgTotalPages] = useState(1);
  const [msgTotal, setMsgTotal] = useState(0);
  const [msgLoading, setMsgLoading] = useState(false);

  // Requeue indicators
  const [requeueingId, setRequeueingId] = useState<number | null>(null);
  const [requeueingBroadcast, setRequeueingBroadcast] = useState(false);

  const isAdminOrSuper = admin?.role === "ADMIN" || admin?.role === "SUPER_ADMIN";

  const fetchDetails = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError(null);
      const response = await api.get(`/broadcasts/${id}`);
      if (response.data?.success) {
        setBroadcast(response.data.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load details");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const fetchMessages = async (page: number = 1, silent = false) => {
    if (!id) return;
    try {
      if (!silent) setMsgLoading(true);
      const response = await api.get(`/broadcasts/${id}/messages?page=${page}&limit=5`);
      if (response.data?.success) {
        setMessages(response.data.data.messages);
        setMsgTotalPages(response.data.data.totalPages);
        setMsgTotal(response.data.data.total);
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (!silent) setMsgLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    if (id) {
      fetchDetails();
      fetchMessages(msgPage);
    }
  }, [id, msgPage]);

  // Polling for Queued and Processing broadcasts
  useEffect(() => {
    if (!broadcast) return;
    
    const isProcessing = broadcast.status === "QUEUED" || broadcast.status === "PROCESSING";
    if (!isProcessing) return;

    let intervalId: any;

    const poll = async () => {
      await fetchDetails(true);
      await fetchMessages(msgPage, true);
    };

    const handleVisibility = () => {
      if (document.hidden) {
        clearInterval(intervalId);
      } else {
        clearInterval(intervalId);
        intervalId = setInterval(poll, 5000);
      }
    };

    intervalId = setInterval(poll, 5000);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [broadcast, msgPage]);

  const handleRequeueMessage = async (msgId: number) => {
    try {
      setRequeueingId(msgId);
      const response = await api.post(`/messages/${msgId}/requeue`);
      if (response.data?.success) {
        fetchDetails(true);
        fetchMessages(msgPage, true);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to requeue message");
    } finally {
      setRequeueingId(null);
    }
  };

  const handleRequeueFailedBroadcast = async () => {
    if (!id) return;
    try {
      setRequeueingBroadcast(true);
      const response = await api.post(`/broadcasts/${id}/requeue-failed`);
      if (response.data?.success) {
        fetchDetails(true);
        fetchMessages(msgPage, true);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to requeue failed campaign messages");
    } finally {
      setRequeueingBroadcast(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
      </div>
    );
  }

  if (error || !broadcast) {
    return (
      <div className="rounded-xl bg-red-50 p-6 text-red-700 dark:bg-red-950/30 dark:text-red-400 border border-red-100 dark:border-red-900/50">
        <p className="font-semibold">Error Loading Details</p>
        <p className="text-sm mt-1">{error || "Broadcast not found"}</p>
        <Link to="/broadcasts" className="inline-flex items-center text-xs font-bold text-red-800 dark:text-red-400 mt-4 hover:underline">
          <ArrowLeft className="h-3 w-3 mr-1" /> Back to campaigns
        </Link>
      </div>
    );
  }

  // Aggregate stats based on messageStats property
  const stats = broadcast.messageStats || { QUEUED: 0, PROCESSING: 0, SUBMITTED: 0, FAILED: 0, CANCELLED: 0 };
  const queuedCount = stats.QUEUED;
  const processingCount = stats.PROCESSING;
  const submittedCount = stats.SUBMITTED;
  const failedCount = stats.FAILED;
  const cancelledCount = stats.CANCELLED;

  const terminalCount = submittedCount + failedCount + cancelledCount;
  const total = broadcast.totalRecipients;

  // For high-fidelity progress bar on active processing
  const progressPercent = total > 0
    ? Math.round((terminalCount / total) * 100)
    : 0;

  // Calculate timeline events
  const timeline = [
    { label: "Created Draft", date: broadcast.createdAt, by: broadcast.createdBy?.name || "Unknown" },
  ];
  if (broadcast.submittedAt) {
    timeline.push({ label: "Submitted for Approval", date: broadcast.submittedAt, by: broadcast.createdBy?.name || "Unknown" });
  }
  if (broadcast.approvedAt) {
    timeline.push({ label: "Approved by Reviewer", date: broadcast.approvedAt, by: broadcast.approvedBy?.name || "Unknown" });
  }
  if (broadcast.rejectedAt) {
    timeline.push({ label: "Rejected by Reviewer", date: broadcast.rejectedAt, by: broadcast.rejectedBy?.name || "Unknown" });
  }
  if (broadcast.queuedAt) {
    timeline.push({ label: "Queued for Delivery", date: broadcast.queuedAt, by: broadcast.approvedBy?.name || "System" });
  }
  if (broadcast.processingStartedAt) {
    timeline.push({ label: "Processing Started", date: broadcast.processingStartedAt, by: "Worker Daemon" });
  }
  if (broadcast.completedAt) {
    timeline.push({ label: "Completed Final Recount", date: broadcast.completedAt, by: "Worker Daemon" });
  }
  if (broadcast.failedAt) {
    timeline.push({ label: "Process Failed", date: broadcast.failedAt, by: "Worker Daemon" });
  }
  if (broadcast.cancelledAt) {
    timeline.push({ label: "Cancelled Campaign", date: broadcast.cancelledAt, by: broadcast.approvedBy?.name || "Admin" });
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "DRAFT":
        return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/40 dark:text-slate-400";
      case "PENDING_APPROVAL":
        return "bg-amber-50 text-amber-700 border-amber-250 dark:bg-amber-950/20 dark:text-amber-400";
      case "APPROVED":
        return "bg-indigo-50 text-indigo-750 border-indigo-200 dark:bg-indigo-950/20 dark:text-indigo-400";
      case "QUEUED":
        return "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/20 dark:text-cyan-400";
      case "PROCESSING":
        return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 animate-pulse";
      case "COMPLETED":
        return "bg-emerald-50 text-emerald-700 border-emerald-250 dark:bg-emerald-950/20 dark:text-emerald-400";
      case "PARTIALLY_FAILED":
        return "bg-orange-50 text-orange-700 border-orange-250 dark:bg-orange-950/20 dark:text-orange-400";
      case "FAILED":
        return "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400";
      case "CANCELLED":
        return "bg-slate-100 text-slate-650 border-slate-200 dark:bg-slate-800/40 dark:text-slate-400";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  const getMessageStatusBadge = (status: string) => {
    switch (status) {
      case "QUEUED":
        return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/25 dark:text-amber-400";
      case "PROCESSING":
        return "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/25 dark:text-indigo-400 animate-pulse";
      case "SUBMITTED":
        return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/25 dark:text-emerald-400";
      case "FAILED":
        return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/25 dark:text-rose-450";
      case "CANCELLED":
        return "bg-slate-100 text-slate-650 border-slate-250 dark:bg-slate-800/40 dark:text-slate-400";
      default:
        return "bg-slate-50 text-slate-600";
    }
  };

  // Determine if requeue failed broadcasts is eligible
  const isTerminal = ["COMPLETED", "PARTIALLY_FAILED", "FAILED"].includes(broadcast.status);

  return (
    <div className="space-y-6 animate-fade-in mx-auto max-w-7xl">
      {/* Header back navigation */}
      <div className="flex items-center justify-between border-b border-tail-border dark:border-tail-dark-border pb-4">
        <div className="flex items-center space-x-3">
          <Link
            to="/broadcasts"
            className="p-1.5 border border-slate-200 hover:bg-slate-50 dark:border-tail-dark-border dark:hover:bg-slate-800 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-350 cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Campaign ID: #{broadcast.id}
            </h2>
            <p className="text-xs text-slate-500">Created on {new Date(broadcast.createdAt).toLocaleString()}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isAdminOrSuper && isTerminal && (
            <Button
              disabled={requeueingBroadcast}
              onClick={handleRequeueFailedBroadcast}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs shadow-2xs transition-colors cursor-pointer disabled:opacity-40"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {requeueingBroadcast ? "Requeueing..." : "Requeue Failed"}
            </Button>
          )}

          <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold border uppercase ${getStatusBadge(broadcast.status)}`}>
            {broadcast.status.replace("_", " ")}
          </span>
        </div>
      </div>

      {/* Progress metrics widget */}
      {["QUEUED", "PROCESSING", "COMPLETED", "PARTIALLY_FAILED", "FAILED"].includes(broadcast.status) && (
        <div className="rounded-lg border border-white/80 bg-white/95 shadow-xs p-6 dark:border-tail-dark-border dark:bg-tail-dark-card space-y-4">
          <div className="flex justify-between items-center text-sm font-semibold">
            <span className="text-slate-500 dark:text-slate-400">Processing Progress</span>
            <span className="font-mono text-slate-900 dark:text-white">{progressPercent}%</span>
          </div>

          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-indigo-650 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-6 gap-4 pt-3 text-center text-xs">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/30 rounded border border-slate-100 dark:border-tail-dark-border/40">
              <span className="block text-slate-400 mb-0.5">Total</span>
              <strong className="text-lg font-bold font-mono text-slate-800 dark:text-white">{broadcast.totalRecipients}</strong>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/30 rounded border border-slate-100 dark:border-tail-dark-border/40">
              <span className="block text-slate-400 mb-0.5">Queue/Retry</span>
              <strong className="text-lg font-bold font-mono text-amber-600">{queuedCount}</strong>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/30 rounded border border-slate-100 dark:border-tail-dark-border/40">
              <span className="block text-slate-400 mb-0.5">Processing</span>
              <strong className="text-lg font-bold font-mono text-blue-600 animate-pulse">{processingCount}</strong>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/30 rounded border border-slate-100 dark:border-tail-dark-border/40">
              <span className="block text-slate-400 mb-0.5">Submitted</span>
              <strong className="text-lg font-bold font-mono text-emerald-600">{submittedCount}</strong>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/30 rounded border border-slate-100 dark:border-tail-dark-border/40">
              <span className="block text-slate-400 mb-0.5">Failed</span>
              <strong className="text-lg font-bold font-mono text-rose-600">{failedCount}</strong>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/30 rounded border border-slate-100 dark:border-tail-dark-border/40">
              <span className="block text-slate-400 mb-0.5">Cancelled</span>
              <strong className="text-lg font-bold font-mono text-slate-600">{cancelledCount}</strong>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Columns: Broadcast Core parameters */}
        <div className="lg:col-span-2 space-y-6">
          {/* Main Campaign body card */}
          <div className="rounded-lg border border-white/80 bg-white/95 shadow-xs p-6 dark:border-tail-dark-border dark:bg-tail-dark-card space-y-5">
            <div>
              <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold block mb-1">
                Campaign Title
              </span>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white font-mono">
                {broadcast.title}
              </h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-3 border-y border-slate-100 dark:border-slate-800 text-xs">
              <div>
                <span className="text-slate-400 block mb-1">Severity</span>
                <span className="font-bold text-slate-700 dark:text-slate-200">{broadcast.severity}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-1">Category</span>
                <span className="font-bold text-slate-700 dark:text-slate-200">{broadcast.category.replace("_", " ")}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-1">Audience</span>
                <span className="font-bold text-indigo-650 dark:text-indigo-400">
                  {broadcast.audienceType === "GROUP"
                    ? `Group: ${broadcast.group?.name || "Deleted"}`
                    : "All Active Subscribers"}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-1">Target Recipients</span>
                <span className="font-bold font-mono text-slate-700 dark:text-slate-200">{broadcast.totalRecipients}</span>
              </div>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold block mb-2">
                Message Template content
              </span>
              <div className="bg-slate-50 dark:bg-tail-dark-bg p-5 rounded-lg border border-slate-100 dark:border-tail-dark-border">
                <p className="text-sm font-serif text-slate-700 dark:text-slate-350 whitespace-pre-wrap leading-relaxed">
                  {broadcast.message}
                </p>
              </div>
            </div>

            {/* If has Rejection or Cancellation Reasons */}
            {broadcast.rejectionReason && (
              <div className="p-4 bg-rose-50 text-rose-800 rounded-lg border border-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/40">
                <h4 className="font-bold text-xs flex items-center mb-1">
                  <XCircle className="h-4 w-4 mr-1.5 shrink-0" /> Rejection Feedback
                </h4>
                <p className="text-xs italic">"{broadcast.rejectionReason}"</p>
              </div>
            )}

            {broadcast.cancellationReason && (
              <div className="p-4 bg-red-50 text-red-800 rounded-lg border border-red-100 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/40">
                <h4 className="font-bold text-xs flex items-center mb-1">
                  <XCircle className="h-4 w-4 mr-1.5 shrink-0" /> Cancellation reason
                </h4>
                <p className="text-xs italic">"{broadcast.cancellationReason}"</p>
              </div>
            )}
          </div>

          {/* Messages Queue details logs */}
          {msgTotal > 0 && (
            <div className="rounded-lg border border-white/80 bg-white/95 shadow-xs p-6 dark:border-tail-dark-border dark:bg-tail-dark-card space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider text-slate-400 border-b border-tail-border dark:border-tail-dark-border pb-3">
                Recipient Message Logs
              </h3>

              {msgLoading ? (
                <div className="flex h-32 items-center justify-center">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent"></div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs min-w-[800px]">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/40 text-slate-400 uppercase font-semibold border-b border-tail-border dark:border-tail-dark-border">
                          <th className="px-4 py-3">Subscriber</th>
                          <th className="px-4 py-3 font-mono">Phone</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Retries</th>
                          <th className="px-4 py-3">Error / Reason</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-tail-border dark:divide-tail-dark-border">
                        {messages.map((msg) => (
                          <tr key={msg.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                            <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-300">
                              {msg.subscriberName || "(No Name)"}
                            </td>
                            <td className="px-4 py-3 font-mono text-slate-500">{msg.phoneNumber}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold border uppercase ${getMessageStatusBadge(msg.status)}`}>
                                {msg.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-mono text-slate-500">{msg.retryCount} / {msg.maxRetries}</td>
                            <td className="px-4 py-3 text-rose-600 max-w-[200px] truncate" title={msg.errorMessage || ""}>
                              {msg.errorCode ? (
                                <div>
                                  <span className="font-semibold block">{msg.errorCode}</span>
                                  <span className="text-[10px] block text-rose-500/80 truncate">{msg.errorMessage}</span>
                                </div>
                              ) : (
                                <span className="text-slate-300 dark:text-slate-700">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {isAdminOrSuper && msg.status === "FAILED" && (
                                <Button
                                  disabled={requeueingId === msg.id}
                                  onClick={() => handleRequeueMessage(msg.id)}
                                  className="inline-flex px-2 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-750 hover:bg-indigo-100 font-bold text-[9px] cursor-pointer transition-colors"
                                >
                                  {requeueingId === msg.id ? "Loading..." : "Requeue"}
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Message pagination */}
                  {msgTotalPages > 1 && (
                    <div className="flex justify-between items-center pt-2 text-xs">
                      <span className="text-slate-400">Page {msgPage} of {msgTotalPages} ({msgTotal} messages)</span>
                      <div className="flex space-x-1">
                        <Button
                          disabled={msgPage <= 1}
                          onClick={() => setMsgPage(msgPage - 1)}
                          className="p-1 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40 cursor-pointer dark:border-tail-dark-border dark:bg-tail-dark-bg"
                        >
                          <ChevronLeft className="h-3 w-3" />
                        </Button>
                        <Button
                          disabled={msgPage >= msgTotalPages}
                          onClick={() => setMsgPage(msgPage + 1)}
                          className="p-1 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40 cursor-pointer dark:border-tail-dark-border dark:bg-tail-dark-bg"
                        >
                          <ChevronRight className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Timeline / audit log */}
        <div className="lg:col-span-1 rounded-lg border border-white/80 bg-white/95 shadow-xs p-6 dark:border-tail-dark-border dark:bg-tail-dark-card space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider text-slate-400 border-b border-tail-border dark:border-tail-dark-border pb-3">
            Workflow Timeline
          </h3>

          <div className="relative pl-6 border-l border-slate-100 dark:border-slate-800 space-y-6 py-2">
            {timeline.map((step, idx) => (
              <div key={idx} className="relative">
                {/* timeline bullet dot */}
                <div className="absolute -left-[30px] top-1 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200 dark:bg-indigo-950 dark:text-indigo-400 dark:border-indigo-900">
                  <Check className="h-2.5 w-2.5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">{step.label}</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">{new Date(step.date).toLocaleString()}</p>
                  <p className="text-[10px] text-slate-500 font-semibold mt-1 flex items-center">
                    <User className="h-3 w-3 mr-1" /> By: {step.by}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
export default BroadcastDetails;
