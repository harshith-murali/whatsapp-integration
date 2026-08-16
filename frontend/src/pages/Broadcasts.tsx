import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/index.js";
import { useAuth } from "../context/AuthContext.js";
import { hasPermission } from "../utils/permissions.js";
import { BroadcastForm } from "../components/BroadcastForm.js";
import { SelectMenu } from "../components/ui/select-menu.js";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert.js";
import { Button } from "../components/ui/button.js";
import {
  Megaphone,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  Edit2,
  Trash2,
  Send,
  CheckCircle,
  XCircle,
  Play,
  StopCircle,
  X,
  CheckCircle2Icon,
  InfoIcon,
  AlertTriangle,
} from "lucide-react";

interface Broadcast {
  id: number;
  title: string;
  message: string;
  category: string;
  severity: string;
  audienceType: string;
  groupId: number | null;
  messageTemplateId: number | null;
  status: string;
  totalRecipients: number;
  createdById: number;
  rejectionReason: string | null;
  cancellationReason: string | null;
  createdAt: string;
  createdBy: { name: string };
  group: { name: string } | null;
}

interface ConfirmationState {
  title: string;
  description: string;
  confirmLabel: string;
  tone: "info" | "success" | "danger";
  icon: React.ComponentType<{ className?: string }>;
  onConfirm: () => Promise<void>;
}

export const Broadcasts: React.FC = () => {
  const { admin } = useAuth();
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters/Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Views / Workflows
  const [activeFormMode, setActiveFormMode] = useState<"list" | "create" | "edit">("list");
  const [editingBroadcast, setEditingBroadcast] = useState<Broadcast | null>(null);
  const [submittingId, setSubmittingId] = useState<number | null>(null);

  // Workflow actions modals
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [selectedBroadcast, setSelectedBroadcast] = useState<Broadcast | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Preview / Queue modal
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewData, setPreviewData] = useState<any | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [confirmQueueChecked, setConfirmQueueChecked] = useState(false);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationState | null>(null);

  // RBAC Checks
  const canCreate = hasPermission(admin?.role, "broadcasts.create");
  const canApprove = hasPermission(admin?.role, "broadcasts.approve");
  const canQueue = hasPermission(admin?.role, "broadcasts.queue");
  const canCancel = hasPermission(admin?.role, "broadcasts.cancel");
  const canDelete = hasPermission(admin?.role, "broadcasts.delete");
  const statusFilterOptions = [
    { value: "", label: "All Statuses" },
    { value: "DRAFT", label: "DRAFT" },
    { value: "PENDING_APPROVAL", label: "PENDING APPROVAL" },
    { value: "APPROVED", label: "APPROVED" },
    { value: "REJECTED", label: "REJECTED" },
    { value: "QUEUED", label: "QUEUED" },
    { value: "CANCELLED", label: "CANCELLED" },
  ];

  const fetchBroadcasts = async () => {
    try {
      setLoading(true);
      setError(null);
      let url = `/broadcasts?page=${page}&search=${search}`;
      if (statusFilter) {
        url += `&status=${statusFilter}`;
      }
      const response = await api.get(url);
      if (response.data?.success) {
        setBroadcasts(response.data.data.broadcasts);
        setTotalPages(response.data.data.totalPages);
        setTotal(response.data.data.total);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load campaigns");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeFormMode === "list") {
      fetchBroadcasts();
    }
  }, [page, statusFilter, activeFormMode]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchBroadcasts();
  };

  // Form submit handler (saves or submits drafts)
  const handleFormSubmit = async (formData: any) => {
    try {
      setActionLoading(true);
      if (activeFormMode === "create") {
        const response = await api.post("/broadcasts", formData);
        if (response.data?.success) {
          const newBc = response.data.data;
          if (formData.submitImmediately) {
            await api.post(`/broadcasts/${newBc.id}/submit`);
          }
        }
      } else if (activeFormMode === "edit" && editingBroadcast) {
        await api.patch(`/broadcasts/${editingBroadcast.id}`, formData);
        if (formData.submitImmediately) {
          await api.post(`/broadcasts/${editingBroadcast.id}/submit`);
        }
      }
      setActiveFormMode("list");
      setEditingBroadcast(null);
      setPage(1);
      fetchBroadcasts();
    } catch (err: any) {
      alert(err.response?.data?.message || "Operation failed");
    } finally {
      setActionLoading(false);
    }
  };

  // Lifecycle workflow actions
  const handleSubmitForApproval = async (id: number) => {
    setConfirmation({
      title: "Submit Campaign",
      description: "Submit this campaign draft for approval. Reviewers will be able to approve or reject it.",
      confirmLabel: "Submit",
      tone: "info",
      icon: InfoIcon,
      onConfirm: async () => {
        try {
          setSubmittingId(id);
          const response = await api.post(`/broadcasts/${id}/submit`);
          if (response.data?.success) {
            fetchBroadcasts();
          }
        } catch (err: any) {
          alert(err.response?.data?.message || "Submission failed");
        } finally {
          setSubmittingId(null);
        }
      },
    });
  };

  const handleApprove = async (id: number) => {
    setConfirmation({
      title: "Approve Broadcast",
      description: "Approve this broadcast. It will be ready to queue immediately after approval.",
      confirmLabel: "Approve",
      tone: "success",
      icon: CheckCircle2Icon,
      onConfirm: async () => {
        try {
          const response = await api.post(`/broadcasts/${id}/approve`);
          if (response.data?.success) {
            fetchBroadcasts();
          }
        } catch (err: any) {
          alert(err.response?.data?.message || "Approval failed");
        }
      },
    });
  };

  const openRejectModal = (bc: Broadcast) => {
    setSelectedBroadcast(bc);
    setActionReason("");
    setRejectModalOpen(true);
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBroadcast || !actionReason.trim()) return;
    try {
      setActionLoading(true);
      const response = await api.post(`/broadcasts/${selectedBroadcast.id}/reject`, {
        reason: actionReason.trim(),
      });
      if (response.data?.success) {
        setRejectModalOpen(false);
        fetchBroadcasts();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || "Rejection failed");
    } finally {
      setActionLoading(false);
    }
  };

  const openCancelModal = (bc: Broadcast) => {
    setSelectedBroadcast(bc);
    setActionReason("");
    setCancelModalOpen(true);
  };

  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBroadcast || !actionReason.trim()) return;
    try {
      setActionLoading(true);
      const response = await api.post(`/broadcasts/${selectedBroadcast.id}/cancel`, {
        reason: actionReason.trim(),
      });
      if (response.data?.success) {
        setCancelModalOpen(false);
        fetchBroadcasts();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || "Cancellation failed");
    } finally {
      setActionLoading(false);
    }
  };

  const openRecipientPreview = async (bc: Broadcast) => {
    setSelectedBroadcast(bc);
    setConfirmQueueChecked(false);
    setQueueError(null);
    setPreviewModalOpen(true);
    setPreviewData(null);
    try {
      setPreviewLoading(true);
      const response = await api.get(`/broadcasts/${bc.id}/recipient-preview`);
      if (response.data?.success) {
        setPreviewData(response.data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleQueueBroadcast = async () => {
    if (!selectedBroadcast || !confirmQueueChecked) return;
    setQueueError(null);
    try {
      setActionLoading(true);
      const response = await api.post(`/broadcasts/${selectedBroadcast.id}/queue`);
      if (response.data?.success) {
        setPreviewModalOpen(false);
        fetchBroadcasts();
      }
    } catch (err: any) {
      setQueueError(err.response?.data?.message || "Failed to queue messages");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteBroadcast = async (id: number) => {
    const broadcast = broadcasts.find((bc) => bc.id === id);
    const label = broadcast?.status === "DRAFT" ? "draft" : "broadcast";

    setConfirmation({
      title: "Delete Broadcast",
      description: `Permanently delete this ${label}. Related recipient message logs for this broadcast will also be removed. This action cannot be undone.`,
      confirmLabel: "Delete",
      tone: "danger",
      icon: AlertTriangle,
      onConfirm: async () => {
        try {
          const response = await api.delete(`/broadcasts/${id}`);
          if (response.data?.success) {
            fetchBroadcasts();
          }
        } catch (err: any) {
          alert(err.response?.data?.message || "Delete failed");
        }
      },
    });
  };

  const handleConfirmAction = async () => {
    if (!confirmation) return;
    try {
      setActionLoading(true);
      await confirmation.onConfirm();
      setConfirmation(null);
    } finally {
      setActionLoading(false);
    }
  };

  const canDeleteBroadcast = (bc: Broadcast) =>
    canDelete && ["DRAFT", "REJECTED", "CANCELLED", "FAILED"].includes(bc.status);

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "PENDING_APPROVAL":
        return "Pending approval";
      default:
        return status
          .toLowerCase()
          .split("_")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ");
    }
  };

  // Status badge coloring
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

  // Render form workflows
  if (activeFormMode === "create") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-tail-border dark:border-tail-dark-border pb-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Create Broadcast Draft
            </h2>
            <p className="text-sm text-slate-500 mt-1">Configure your message templates and audience targets.</p>
          </div>
          <Button
            onClick={() => setActiveFormMode("list")}
            variant="outline"
          >
            Cancel Draft
          </Button>
        </div>
        <BroadcastForm onSubmit={handleFormSubmit} loading={actionLoading} />
      </div>
    );
  }

  if (activeFormMode === "edit" && editingBroadcast) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-tail-border dark:border-tail-dark-border pb-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Modify Broadcast Campaign
            </h2>
            <p className="text-sm text-slate-500 mt-1">Update parameters for draft ID: {editingBroadcast.id}</p>
          </div>
          <Button
            onClick={() => {
              setActiveFormMode("list");
              setEditingBroadcast(null);
            }}
            variant="outline"
          >
            Back to List
          </Button>
        </div>

        {editingBroadcast.status === "REJECTED" && (
          <div className="rounded-lg bg-rose-50 text-rose-800 p-4 text-sm border border-rose-100 dark:bg-rose-950/20 dark:text-rose-450 dark:border-rose-900/50">
            <h4 className="font-bold">Rejection Reason:</h4>
            <p className="mt-1 italic">"{editingBroadcast.rejectionReason}"</p>
          </div>
        )}

        <BroadcastForm
          initialValues={{
            title: editingBroadcast.title,
            message: editingBroadcast.message,
            category: editingBroadcast.category,
            severity: editingBroadcast.severity,
            audienceType: editingBroadcast.audienceType,
            groupId: editingBroadcast.groupId,
            messageTemplateId: editingBroadcast.messageTemplateId,
          }}
          onSubmit={handleFormSubmit}
          loading={actionLoading}
        />
      </div>
    );
  }

  const ConfirmationIcon = confirmation?.icon;
  const confirmationToneClass =
    confirmation?.tone === "danger"
      ? "border-rose-200 bg-rose-50/80 text-rose-950 dark:border-rose-900/60 dark:bg-rose-950/20 dark:text-rose-100"
      : confirmation?.tone === "success"
        ? "border-emerald-200 bg-emerald-50/80 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-100"
        : "border-indigo-200 bg-indigo-50/80 text-indigo-950 dark:border-indigo-900/60 dark:bg-indigo-950/20 dark:text-indigo-100";
  const confirmationIconClass =
    confirmation?.tone === "danger"
      ? "text-rose-600 dark:text-rose-400"
      : confirmation?.tone === "success"
        ? "text-emerald-600 dark:text-emerald-400"
        : "text-indigo-600 dark:text-indigo-400";
  const confirmationButtonClass =
    confirmation?.tone === "danger"
      ? "bg-rose-600 hover:bg-rose-700"
      : confirmation?.tone === "success"
        ? "bg-emerald-600 hover:bg-emerald-700"
        : "bg-indigo-600 hover:bg-indigo-700";

  return (
    <>
      <div className="space-y-6 animate-fade-in">
        {/* Header and Title */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Broadcast Campaigns
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Send, schedule, and approve system WhatsApp alert broadcasts.
            </p>
          </div>
          {canCreate && (
            <Button
              onClick={() => setActiveFormMode("create")}
            >
              <Plus className="h-4 w-4 mr-2" />
              New Campaign
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="bg-white p-5 rounded-lg border border-tail-border shadow-xs dark:bg-tail-dark-card dark:border-tail-dark-border">
          <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative md:col-span-2">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Search className="h-4 w-4" />
              </span>
              <input
                type="text"
                placeholder="Search campaigns..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="block w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-4 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-hidden dark:border-tail-dark-border dark:bg-tail-dark-bg dark:text-white dark:focus:bg-tail-dark-bg"
              />
            </div>
            <div>
              <SelectMenu
                value={statusFilter}
                options={statusFilterOptions}
                onValueChange={(value) => {
                  setStatusFilter(value);
                  setPage(1);
                }}
                label="Status"
              />
            </div>
            <Button
              type="submit"
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-lg transition-colors cursor-pointer"
            >
              Search
            </Button>
          </form>
        </div>

        {/* Database List */}
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
          </div>
        ) : error ? (
          <div className="rounded-xl bg-red-50 p-6 text-red-700 dark:bg-red-950/30 dark:text-red-400 border border-red-100 dark:border-red-900/50">
            <p className="font-semibold">Failed to fetch broadcasts</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        ) : broadcasts.length === 0 ? (
          <div className="rounded-lg bg-white border border-tail-border p-16 text-center dark:bg-tail-dark-card dark:border-tail-dark-border">
            <Megaphone className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-800 dark:text-white">No Broadcast Campaigns Found</h3>
            <p className="text-sm text-slate-400 mt-2 max-w-sm mx-auto">
              Draft a new campaign to begin scheduling WhatsApp alerts for subscribers.
            </p>
          </div>
        ) : (
          <div className="rounded-lg bg-white shadow-xs border border-tail-border dark:bg-tail-dark-card dark:border-tail-dark-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 text-xs uppercase font-semibold border-b border-tail-border dark:border-tail-dark-border">
                    <th className="px-5 py-4">Title</th>
                    <th className="px-5 py-4">Audience</th>
                    <th className="px-5 py-4">Category</th>
                    <th className="px-5 py-4">Severity</th>
                    <th className="px-5 py-4">Recipients</th>
                    <th className="px-5 py-4 w-[160px]">Status</th>
                    <th className="px-5 py-4">Created By</th>
                    <th className="px-5 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-tail-border dark:divide-tail-dark-border text-sm">
                  {broadcasts.map((bc) => (
                    <tr key={bc.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                      <td className="px-5 py-4 font-bold text-slate-900 dark:text-white">
                        <Link to={`/broadcasts/${bc.id}`} className="hover:text-indigo-650 hover:underline">
                          {bc.title}
                        </Link>
                      </td>
                      <td className="px-5 py-4 text-slate-650 dark:text-slate-350">
                        {bc.audienceType === "GROUP"
                          ? `Group: ${bc.group?.name || "Deleted Group"}`
                          : "All Active Subscribers"}
                      </td>
                      <td className="px-5 py-4 text-slate-500 dark:text-slate-400">
                        {bc.category.replace("_", " ")}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold border uppercase ${
                          bc.severity === "CRITICAL"
                            ? "bg-rose-50 text-rose-700 border-rose-100"
                            : bc.severity === "HIGH"
                            ? "bg-amber-50 text-amber-700 border-amber-100"
                            : "bg-slate-50 text-slate-600 border-slate-200"
                        }`}>
                          {bc.severity}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-slate-600 dark:text-slate-300 font-semibold font-mono">
                        {bc.totalRecipients.toLocaleString()}
                      </td>
                      <td className="px-5 py-4 w-[160px]">
                        <span className={`inline-flex min-w-[116px] items-center justify-center rounded-md border px-2.5 py-1 text-[11px] font-bold leading-none tracking-wide ${getStatusBadge(bc.status)}`}>
                          {getStatusLabel(bc.status)}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-slate-500 dark:text-slate-400">
                        {bc.createdBy.name}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex justify-end items-center space-x-2">
                          <Link
                            to={`/broadcasts/${bc.id}`}
                            className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-700 dark:hover:bg-slate-800"
                            title="View Campaign Details"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>

                          {/* DRAFT actions */}
                          {bc.status === "DRAFT" && (
                            <>
                              <Button
                                onClick={() => setActiveFormMode("edit")}
                                className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-indigo-650 dark:hover:bg-slate-800"
                                title="Edit Draft"
                                onClickCapture={() => setEditingBroadcast(bc)}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                disabled={submittingId === bc.id}
                                onClick={() => handleSubmitForApproval(bc.id)}
                                className="p-1 hover:bg-indigo-50 rounded text-indigo-600 hover:text-indigo-750 dark:hover:bg-indigo-950/20"
                                title="Submit for Approval"
                              >
                                <Send className="h-4 w-4" />
                              </Button>
                            </>
                          )}

                          {/* PENDING APPROVAL review action options */}
                          {bc.status === "PENDING_APPROVAL" && canApprove && (
                            <>
                              <Button
                                onClick={() => handleApprove(bc.id)}
                                className="p-1 hover:bg-emerald-50 rounded text-emerald-600 hover:text-emerald-750 dark:hover:bg-emerald-950/20"
                                title="Approve Broadcast"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                              <Button
                                onClick={() => openRejectModal(bc)}
                                className="p-1 hover:bg-rose-50 rounded text-rose-600 hover:text-rose-700 dark:hover:bg-rose-950/20"
                                title="Reject Broadcast"
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </>
                          )}

                          {/* APPROVED queuing actions */}
                          {bc.status === "APPROVED" && (
                            <>
                              <Button
                                onClick={() => openRecipientPreview(bc)}
                                className="p-1.5 bg-indigo-50 hover:bg-indigo-150 rounded text-indigo-700 text-xs font-semibold flex items-center dark:bg-indigo-950/20 dark:text-indigo-400"
                                title="Preview and Queue"
                              >
                                <Play className="h-3.5 w-3.5 mr-1" /> Queue
                              </Button>
                              {canCancel && (
                                <Button
                                  onClick={() => openCancelModal(bc)}
                                  className="p-1 hover:bg-red-50 rounded text-red-600 hover:text-red-750 dark:hover:bg-red-950/20"
                                  title="Cancel Broadcast"
                                >
                                  <StopCircle className="h-4 w-4" />
                                </Button>
                              )}
                            </>
                          )}

                          {/* REJECTED edit action */}
                          {bc.status === "REJECTED" && (
                            <Button
                              onClick={() => {
                                setEditingBroadcast(bc);
                                setActiveFormMode("edit");
                              }}
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 rounded text-rose-700 text-xs font-semibold dark:bg-rose-950/20 dark:text-rose-400"
                              title="Modify and Resubmit"
                            >
                              <Edit2 className="h-3.5 w-3.5 mr-1" /> Resubmit
                            </Button>
                          )}

                          {/* QUEUED cancellation action */}
                          {bc.status === "QUEUED" && canCancel && (
                            <Button
                              onClick={() => openCancelModal(bc)}
                              className="p-1.5 bg-red-50 hover:bg-red-100 rounded text-red-700 text-xs font-semibold flex items-center dark:bg-red-950/20 dark:text-red-400"
                              title="Cancel Queueing"
                            >
                              <StopCircle className="h-3.5 w-3.5 mr-1" /> Cancel
                            </Button>
                          )}

                          {canDeleteBroadcast(bc) && (
                            <Button
                              onClick={() => handleDeleteBroadcast(bc.id)}
                              className="p-1 hover:bg-red-50 rounded text-slate-500 hover:text-red-650 dark:hover:bg-red-950/20"
                              title="Delete Broadcast"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
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
                  Page {page} of {totalPages} ({total} campaigns)
                </span>
                <div className="flex space-x-2">
                          <Button
                            disabled={page <= 1}
                            onClick={() => setPage(page - 1)}
                            variant="outline"
                            size="icon"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <Button
                            disabled={page >= totalPages}
                            onClick={() => setPage(page + 1)}
                            variant="outline"
                            size="icon"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {confirmation && ConfirmationIcon && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg animate-zoom-in rounded-lg border border-tail-border bg-white p-4 shadow-2xl shadow-slate-900/20 dark:border-tail-dark-border dark:bg-tail-dark-card">
            <Alert className={confirmationToneClass}>
              <ConfirmationIcon className={`mt-0.5 h-5 w-5 ${confirmationIconClass}`} />
              <div>
                <AlertTitle>{confirmation.title}</AlertTitle>
                <AlertDescription>{confirmation.description}</AlertDescription>
              </div>
            </Alert>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                disabled={actionLoading}
                onClick={() => setConfirmation(null)}
                className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-tail-dark-border dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={actionLoading}
                onClick={handleConfirmAction}
                className={`rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-colors disabled:opacity-50 ${confirmationButtonClass}`}
              >
                {actionLoading ? "Working..." : confirmation.confirmLabel}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* REJECT MODAL */}
      {rejectModalOpen && selectedBroadcast && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white dark:bg-tail-dark-card rounded-lg shadow-xl border border-tail-border dark:border-tail-dark-border overflow-hidden animate-zoom-in">
            <div className="px-6 py-5 border-b border-tail-border dark:border-tail-dark-border flex justify-between items-center bg-slate-50 dark:bg-tail-dark-card">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Reject Broadcast draft
              </h3>
              <Button
                onClick={() => setRejectModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <form onSubmit={handleRejectSubmit}>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                    Reason for Rejection (Required)
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={actionReason}
                    onChange={(e) => setActionReason(e.target.value)}
                    placeholder="Specify why this broadcast alert has been rejected..."
                    className="block w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-hidden dark:border-tail-dark-border dark:bg-tail-dark-bg dark:text-white dark:focus:bg-tail-dark-bg"
                  />
                </div>
              </div>

              <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/40 border-t border-tail-border dark:border-tail-dark-border flex justify-end space-x-2">
                <Button
                  type="button"
                  onClick={() => setRejectModalOpen(false)}
                  variant="ghost"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={actionLoading}
                  variant="destructive"
                >
                  Reject draft
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CANCEL MODAL */}
      {cancelModalOpen && selectedBroadcast && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white dark:bg-tail-dark-card rounded-lg shadow-xl border border-tail-border dark:border-tail-dark-border overflow-hidden animate-zoom-in">
            <div className="px-6 py-5 border-b border-tail-border dark:border-tail-dark-border flex justify-between items-center bg-slate-50 dark:bg-tail-dark-card">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Cancel Active Campaign?
              </h3>
              <Button
                onClick={() => setCancelModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <form onSubmit={handleCancelSubmit}>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                    Reason for Cancellation (Required)
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={actionReason}
                    onChange={(e) => setActionReason(e.target.value)}
                    placeholder="Specify why this active or approved campaign is being cancelled..."
                    className="block w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-hidden dark:border-tail-dark-border dark:bg-tail-dark-bg dark:text-white dark:focus:bg-tail-dark-bg"
                  />
                </div>
              </div>

              <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/40 border-t border-tail-border dark:border-tail-dark-border flex justify-end space-x-2">
                <Button
                  type="button"
                  onClick={() => setCancelModalOpen(false)}
                  variant="ghost"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={actionLoading}
                  variant="destructive"
                >
                  Cancel Campaign
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECIPIENT PREVIEW & QUEUE CONFIRM MODAL */}
      {previewModalOpen && selectedBroadcast && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg bg-white dark:bg-tail-dark-card rounded-lg shadow-xl border border-tail-border dark:border-tail-dark-border overflow-hidden animate-zoom-in">
            <div className="px-6 py-5 border-b border-tail-border dark:border-tail-dark-border flex justify-between items-center bg-slate-50 dark:bg-tail-dark-card">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Recipient Preview & Queue Confirmation
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 font-semibold font-mono">
                  Campaign: {selectedBroadcast.title}
                </p>
              </div>
              <Button
                onClick={() => setPreviewModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="p-6 space-y-4 max-h-[500px] overflow-y-auto">
              {queueError && (
                <Alert className="border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/20 dark:text-rose-100">
                  <AlertTriangle className="mt-0.5 h-5 w-5 text-rose-600 dark:text-rose-400" />
                  <div>
                    <AlertTitle>Queue failed</AlertTitle>
                    <AlertDescription className="text-rose-700 dark:text-rose-300">
                      {queueError}
                    </AlertDescription>
                  </div>
                </Alert>
              )}
              {previewLoading ? (
                <div className="flex flex-col items-center justify-center py-10 space-y-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
                  <p className="text-xs text-slate-400">Resolving target audience counts...</p>
                </div>
              ) : !previewData ? (
                <p className="text-xs text-slate-400 italic text-center py-4">Failed to load preview.</p>
              ) : (
                <div className="space-y-4">
                  {/* Summary count cards */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/15 rounded-lg border border-indigo-100/50 dark:border-indigo-900/40">
                      <span className="text-xs text-indigo-700 dark:text-indigo-400 font-semibold uppercase tracking-wider block">
                        Eligible Recipients
                      </span>
                      <strong className="text-3xl text-indigo-900 dark:text-indigo-300 font-mono block mt-1">
                        {previewData.eligibleRecipients}
                      </strong>
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-slate-800/45 rounded-lg border border-slate-100 dark:border-tail-dark-border/40">
                      <span className="text-xs text-slate-400 uppercase tracking-wider block">
                        Total Matched Group/All
                      </span>
                      <strong className="text-3xl text-slate-700 dark:text-slate-350 font-mono block mt-1">
                        {previewData.totalMatched}
                      </strong>
                    </div>
                  </div>

                  {/* Exclusions Breakdown */}
                  <div className="border border-slate-100 dark:border-tail-dark-border/60 rounded-lg p-4 space-y-2 text-xs">
                    <h4 className="font-semibold uppercase tracking-wider text-slate-400 mb-2">Exclusion Details</h4>
                    <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-850">
                      <span className="text-slate-500">Excluded Unsubscribed:</span>
                      <strong className="font-mono text-slate-700 dark:text-slate-300">{previewData.excludedUnsubscribed}</strong>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-850">
                      <span className="text-slate-500">Excluded Blocked:</span>
                      <strong className="font-mono text-slate-700 dark:text-slate-300">{previewData.excludedBlocked}</strong>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-850">
                      <span className="text-slate-500">Excluded Opted-Out (No consent):</span>
                      <strong className="font-mono text-slate-700 dark:text-slate-300">{previewData.excludedOptedOut}</strong>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500">Deduplicated Phone Numbers:</span>
                      <strong className="font-mono text-slate-700 dark:text-slate-300">{previewData.duplicateNumbersExcluded}</strong>
                    </div>
                  </div>

                  {/* Sample recipients list */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Masked Recipients Sample</h4>
                    {previewData.sampleRecipients.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No sample matching eligible subscribers.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {previewData.sampleRecipients.map((s: any) => (
                          <div key={s.id} className="flex justify-between p-2 bg-slate-50 dark:bg-slate-800/30 rounded border border-slate-100/50 text-xs dark:border-tail-dark-border/40">
                            <span className="font-bold text-slate-750 dark:text-slate-300">{s.name}</span>
                            <span className="font-mono text-slate-500">{s.phoneNumber}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Explicit confirmation checkbox */}
                  {previewData.eligibleRecipients > 0 && canQueue && (
                    <div className="flex items-start space-x-3 p-3 bg-amber-50/50 dark:bg-amber-950/15 rounded-lg border border-amber-100/50 dark:border-amber-900/30">
                      <input
                        type="checkbox"
                        id="confirmQueueCheck"
                        checked={confirmQueueChecked}
                        onChange={(e) => setConfirmQueueChecked(e.target.checked)}
                        className="mt-0.5 h-4 w-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                      />
                      <label htmlFor="confirmQueueCheck" className="text-xs font-semibold text-amber-800 dark:text-amber-400 leading-tight">
                        I confirm that I want to queue this broadcast for {previewData.eligibleRecipients} eligible active recipients. This action will create pending message entries in the database.
                      </label>
                    </div>
                  )}

                  {previewData.eligibleRecipients === 0 && (
                    <div className="p-3 bg-red-50/50 dark:bg-red-950/15 rounded-lg border border-red-100/50 text-xs font-semibold text-red-800 dark:text-red-400 leading-tight text-center">
                      There are zero eligible active/opted-in recipients matching the filters. This broadcast cannot be queued.
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/40 border-t border-tail-border dark:border-tail-dark-border flex justify-end space-x-2">
              <Button
                type="button"
                onClick={() => setPreviewModalOpen(false)}
                variant="ghost"
              >
                Cancel
              </Button>
              {previewData && previewData.eligibleRecipients > 0 && canQueue && (
                <Button
                  type="button"
                  disabled={!confirmQueueChecked || actionLoading}
                  onClick={handleQueueBroadcast}
                  variant="default"
                >
                  {actionLoading ? "Queueing..." : "Queue Broadcast"}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
export default Broadcasts;
