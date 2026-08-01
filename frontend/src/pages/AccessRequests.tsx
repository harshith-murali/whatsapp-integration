import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  CalendarIcon,
  Eye,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserRoundCheck,
  X,
  XCircle,
} from "lucide-react";
import { api } from "../api/index.js";
import { Button } from "../components/ui/button.js";
import { SelectMenu } from "../components/ui/select-menu.js";
import { Calendar } from "../components/ui/calendar.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu.js";

type AccessRequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "WITHDRAWN";
type RequestRole = "ADMIN" | "OPERATOR" | "VIEWER";

interface AccessRequestListItem {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  company?: string | null;
  requestedRole?: RequestRole | null;
  status: AccessRequestStatus;
  createdAt: string;
  reviewedAt?: string | null;
}

interface AccessRequestDetail extends AccessRequestListItem {
  department?: string | null;
  reason?: string | null;
  rejectionReason?: string | null;
  approvalNotes?: string | null;
  reviewedBy?: { id: number; name: string; email: string; role: string } | null;
  createdAdmin?: { id: number; name: string; email: string; role: string; isActive: boolean } | null;
}

interface AuditLogItem {
  id: number;
  action: string;
  createdAt: string;
  admin?: { name: string; role: string } | null;
}

const statusOptions = [
  { value: "", label: "All statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "WITHDRAWN", label: "Withdrawn" },
];

const roleOptions = [
  { value: "", label: "All requested roles" },
  { value: "ADMIN", label: "Admin" },
  { value: "OPERATOR", label: "Operator" },
  { value: "VIEWER", label: "Viewer" },
];

const finalRoleOptions = [
  { value: "ADMIN", label: "Admin" },
  { value: "OPERATOR", label: "Operator" },
  { value: "VIEWER", label: "Viewer" },
];

const statusClasses: Record<AccessRequestStatus, string> = {
  PENDING: "border-amber-200 bg-amber-50 text-amber-700",
  APPROVED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  REJECTED: "border-rose-200 bg-rose-50 text-rose-700",
  WITHDRAWN: "border-slate-200 bg-slate-100 text-slate-600",
};

const formatDate = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "-";

const formatFilterDate = (value: string) =>
  value
    ? new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(new Date(`${value}T00:00:00`))
    : "Select date";

const generateClientPassword = () => {
  const bytes = new Uint8Array(12);
  window.crypto.getRandomValues(bytes);
  const raw = Array.from(bytes, (byte) => byte.toString(36)).join("");
  return `Temp#${raw.slice(0, 14)}Aa1!`;
};

export const AccessRequests: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [requests, setRequests] = useState<AccessRequestListItem[]>([]);
  const [detail, setDetail] = useState<AccessRequestDetail | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [requestedRole, setRequestedRole] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [finalRole, setFinalRole] = useState<RequestRole>("VIEWER");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [approvalNotes, setApprovalNotes] = useState("");
  const [sendInvitation, setSendInvitation] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [sensitivePassword, setSensitivePassword] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const query = useMemo(
    () => ({
      page,
      limit: 10,
      search: search || undefined,
      status: status || undefined,
      requestedRole: requestedRole || undefined,
      dateFrom: dateFrom ? new Date(dateFrom).toISOString() : undefined,
      dateTo: dateTo ? new Date(`${dateTo}T23:59:59`).toISOString() : undefined,
    }),
    [dateFrom, dateTo, page, requestedRole, search, status]
  );

  const fetchRequests = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get("/access-requests", { params: query });
      setRequests(response.data.data.requests);
      setTotalPages(response.data.data.totalPages || 1);
      setPendingCount(response.data.data.pendingCount || 0);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load access requests.");
    } finally {
      setLoading(false);
    }
  };

  const fetchDetail = async (requestId: number) => {
    setDetailLoading(true);
    setActionError(null);
    try {
      const response = await api.get(`/access-requests/${requestId}`);
      setDetail(response.data.data.request);
      setAuditLogs(response.data.data.auditLogs || []);
      setFinalRole(response.data.data.request.requestedRole || "VIEWER");
    } catch (err: any) {
      setActionError(err.response?.data?.message || "Failed to load access request details.");
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [query]);

  useEffect(() => {
    if (id) {
      fetchDetail(Number(id));
    } else {
      setDetail(null);
      setAuditLogs([]);
    }
  }, [id]);

  const selectedId = detail?.id || (id ? Number(id) : null);

  const refreshAfterAction = async () => {
    await fetchRequests();
    if (selectedId) await fetchDetail(selectedId);
  };

  const approve = async () => {
    if (!selectedId) return;
    setActionLoading(true);
    setActionError(null);
    setSensitivePassword(null);
    try {
      const response = await api.post(`/access-requests/${selectedId}/approve`, {
        role: finalRole,
        temporaryPassword: temporaryPassword || undefined,
        sendInvitation,
        notes: approvalNotes || undefined,
      });
      setApprovalOpen(false);
      setSensitivePassword(response.data.data.temporaryPassword || null);
      setTemporaryPassword("");
      setApprovalNotes("");
      await refreshAfterAction();
    } catch (err: any) {
      setActionError(err.response?.data?.message || "Failed to approve access request.");
    } finally {
      setActionLoading(false);
    }
  };

  const reject = async () => {
    if (!selectedId) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await api.post(`/access-requests/${selectedId}/reject`, { reason: rejectionReason });
      setRejectOpen(false);
      setRejectionReason("");
      await refreshAfterAction();
    } catch (err: any) {
      setActionError(err.response?.data?.message || "Failed to reject access request.");
    } finally {
      setActionLoading(false);
    }
  };

  const withdraw = async () => {
    if (!selectedId) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await api.post(`/access-requests/${selectedId}/withdraw`);
      await refreshAfterAction();
    } catch (err: any) {
      setActionError(err.response?.data?.message || "Failed to withdraw access request.");
    } finally {
      setActionLoading(false);
    }
  };

  const deleteRequest = async () => {
    if (!selectedId) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await api.delete(`/access-requests/${selectedId}`);
      setDeleteOpen(false);
      navigate("/access-requests");
      await fetchRequests();
    } catch (err: any) {
      setActionError(err.response?.data?.message || "Failed to delete access request.");
    } finally {
      setActionLoading(false);
    }
  };

  const openDetail = (requestId: number) => navigate(`/access-requests/${requestId}`);

  const pending = detail?.status === "PENDING";

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-4">
        <div className="rounded-lg border border-tail-border bg-white p-4 shadow-sm dark:border-tail-dark-border dark:bg-tail-dark-card">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Pending</p>
          <p className="mt-1 text-2xl font-bold text-slate-950 dark:text-white">{pendingCount}</p>
        </div>
      </div>

      <div className="rounded-lg border border-tail-border bg-white p-4 shadow-sm dark:border-tail-dark-border dark:bg-tail-dark-card">
        <div className="grid gap-3 xl:grid-cols-[minmax(260px,1fr)_180px_200px_155px_155px_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => {
                setPage(1);
                setSearch(event.target.value);
              }}
              placeholder="Search name, email, phone, company..."
              className="h-[42px] w-full rounded-lg border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm text-slate-900 outline-hidden focus:border-indigo-500 focus:bg-white dark:border-tail-dark-border dark:bg-tail-dark-bg dark:text-white"
            />
          </div>
          <SelectMenu value={status} options={statusOptions} onValueChange={(value) => { setPage(1); setStatus(value); }} />
          <SelectMenu value={requestedRole} options={roleOptions} onValueChange={(value) => { setPage(1); setRequestedRole(value); }} />
          <DateFilter
            label="From"
            value={dateFrom}
            onSelect={(value) => {
              setPage(1);
              setDateFrom(value);
            }}
          />
          <DateFilter
            label="To"
            value={dateTo}
            onSelect={(value) => {
              setPage(1);
              setDateTo(value);
            }}
          />
          <Button onClick={fetchRequests} className="h-[42px] rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-tail-dark-border dark:bg-tail-dark-card dark:text-slate-300">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-100 bg-rose-50 p-4 text-sm font-medium text-rose-700">
          {error}
        </div>
      )}

      <div className={`grid gap-6 ${id ? "xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]" : "grid-cols-1"}`}>
        <div className="overflow-hidden rounded-lg border border-tail-border bg-white shadow-sm dark:border-tail-dark-border dark:bg-tail-dark-card">
          <div className="overflow-x-auto">
            <table className="min-w-[980px] divide-y divide-tail-border dark:divide-tail-dark-border">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  {["Name", "Email", "Phone", "Company", "Role", "Status", "Submitted", "Actions"].map((head) => (
                    <th key={head} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-tail-border dark:divide-tail-dark-border">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-500">
                      Loading access requests...
                    </td>
                  </tr>
                ) : requests.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-500">
                      No access requests found.
                    </td>
                  </tr>
                ) : (
                  requests.map((request) => (
                    <tr key={request.id} className={detail?.id === request.id ? "bg-indigo-50/60 dark:bg-indigo-950/20" : ""}>
                      <td className="max-w-[150px] px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white">
                        <span className="block truncate">{request.firstName} {request.lastName}</span>
                      </td>
                      <td className="max-w-[210px] px-4 py-3 text-sm text-slate-600 dark:text-slate-300"><span className="block truncate">{request.email}</span></td>
                      <td className="px-4 py-3 font-mono text-sm text-slate-600 dark:text-slate-300">{request.phoneNumber}</td>
                      <td className="max-w-[140px] px-4 py-3 text-sm text-slate-600 dark:text-slate-300"><span className="block truncate">{request.company || "-"}</span></td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{request.requestedRole || "-"}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-bold ${statusClasses[request.status]}`}>
                          {request.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{formatDate(request.createdAt)}</td>
                      <td className="px-4 py-3">
                        <Button onClick={() => openDetail(request.id)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-tail-dark-border dark:bg-tail-dark-card dark:text-slate-300">
                          <Eye className="h-4 w-4" />
                          View
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-tail-border px-5 py-4 dark:border-tail-dark-border">
            <p className="text-sm text-slate-500">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <Button disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                Previous
              </Button>
              <Button disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                Next
              </Button>
            </div>
          </div>
        </div>

        {id && <aside className="rounded-lg border border-tail-border bg-white shadow-sm dark:border-tail-dark-border dark:bg-tail-dark-card">
          <div className="flex items-center justify-between border-b border-tail-border px-5 py-4 dark:border-tail-dark-border">
            <h2 className="text-base font-bold text-slate-950 dark:text-white">Request Details</h2>
            {detail && (
              <Button onClick={() => navigate("/access-requests")} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800">
                <X className="h-5 w-5" />
              </Button>
            )}
          </div>

          <div className="p-5">
            {!id ? (
              <div className="flex min-h-[420px] flex-col items-center justify-center text-center text-sm text-slate-500">
                <UserRoundCheck className="mb-3 h-9 w-9 text-slate-300" />
                Select a request to review details and take action.
              </div>
            ) : detailLoading ? (
              <div className="py-16 text-center text-sm text-slate-500">Loading details...</div>
            ) : detail ? (
              <div className="space-y-5">
                {actionError && (
                  <div className="rounded-lg border border-rose-100 bg-rose-50 p-3 text-sm text-rose-700">
                    {actionError}
                  </div>
                )}
                {sensitivePassword && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    <p className="font-bold">Temporary password shown once</p>
                    <p className="mt-2 font-mono">{sensitivePassword}</p>
                  </div>
                )}

                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Requester</p>
                  <h3 className="mt-1 text-xl font-bold text-slate-950 dark:text-white">{detail.firstName} {detail.lastName}</h3>
                  <p className="mt-1 text-sm text-slate-500">{detail.email}</p>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Info label="Phone" value={detail.phoneNumber} />
                  <Info label="Status" value={detail.status} />
                  <Info label="Company" value={detail.company || "-"} />
                  <Info label="Department" value={detail.department || "-"} />
                  <Info label="Requested Role" value={detail.requestedRole || "-"} />
                  <Info label="Submitted" value={formatDate(detail.createdAt)} />
                  <Info label="Reviewed By" value={detail.reviewedBy?.name || "-"} />
                  <Info label="Reviewed" value={formatDate(detail.reviewedAt)} />
                </div>

                <Info label="Reason" value={detail.reason || "-"} block />
                {detail.rejectionReason && <Info label="Rejection Reason" value={detail.rejectionReason} block />}
                {detail.approvalNotes && <Info label="Approval Notes" value={detail.approvalNotes} block />}
                {detail.createdAdmin && (
                  <Info
                    label="Created Account"
                    value={`${detail.createdAdmin.name} • ${detail.createdAdmin.role} • ${detail.createdAdmin.isActive ? "Active" : "Inactive"}`}
                    block
                  />
                )}

                {pending && (
                  <div className="grid grid-cols-2 gap-3 border-t border-tail-border pt-5 dark:border-tail-dark-border">
                    <Button onClick={() => setApprovalOpen(true)} className="h-11 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700">
                      <ShieldCheck className="h-4 w-4" />
                      Approve
                    </Button>
                    <Button onClick={() => setRejectOpen(true)} className="h-11 rounded-lg border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-700 hover:bg-rose-100">
                      <XCircle className="h-4 w-4" />
                      Reject
                    </Button>
                    <Button onClick={withdraw} disabled={actionLoading} className="h-11 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                      Withdraw
                    </Button>
                  </div>
                )}

                {detail.status !== "APPROVED" && (
                  <Button onClick={() => setDeleteOpen(true)} className="w-full rounded-lg border border-rose-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-50">
                    <Trash2 className="h-4 w-4" />
                    Delete request
                  </Button>
                )}

                <div className="border-t border-tail-border pt-5 dark:border-tail-dark-border">
                  <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Audit History</p>
                  <div className="space-y-3">
                    {auditLogs.length === 0 ? (
                      <p className="text-sm text-slate-500">No audit events yet.</p>
                    ) : (
                      auditLogs.map((log) => (
                        <div key={log.id} className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/50">
                          <p className="font-semibold text-slate-800 dark:text-slate-100">{log.action}</p>
                          <p className="mt-1 text-xs text-slate-500">{formatDate(log.createdAt)}{log.admin ? ` • ${log.admin.name}` : ""}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-16 text-center text-sm text-slate-500">Request not found.</div>
            )}
          </div>
        </aside>}
      </div>

      {approvalOpen && (
        <Modal title="Approve access request" onClose={() => setApprovalOpen(false)}>
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Assign role</label>
              <SelectMenu value={finalRole} options={finalRoleOptions} onValueChange={(value) => setFinalRole(value as RequestRole)} />
              <p className="mt-2 text-xs text-slate-500">The requester preference is advisory only. Super Admin chooses the final role.</p>
            </div>
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Temporary password</label>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <input
                  type="text"
                  value={temporaryPassword}
                  onChange={(event) => setTemporaryPassword(event.target.value)}
                  placeholder="Leave blank to generate"
                  className="h-[42px] rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-hidden focus:border-indigo-500"
                />
                <Button onClick={() => setTemporaryPassword(generateClientPassword())} className="rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                  Generate
                </Button>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input type="checkbox" checked={sendInvitation} onChange={(event) => setSendInvitation(event.target.checked)} />
              Send invitation when email integration is available
            </label>
            <textarea
              value={approvalNotes}
              onChange={(event) => setApprovalNotes(event.target.value)}
              placeholder="Approval notes"
              rows={3}
              className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-hidden focus:border-indigo-500"
            />
            <Button disabled={actionLoading} onClick={approve} className="h-11 w-full rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700">
              {actionLoading ? "Approving..." : "Approve and Create Account"}
            </Button>
          </div>
        </Modal>
      )}

      {rejectOpen && (
        <Modal title="Reject access request" onClose={() => setRejectOpen(false)}>
          <div className="space-y-4">
            <textarea
              value={rejectionReason}
              onChange={(event) => setRejectionReason(event.target.value)}
              placeholder="Rejection reason"
              rows={4}
              className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-hidden focus:border-indigo-500"
            />
            <Button disabled={actionLoading || !rejectionReason.trim()} onClick={reject} className="h-11 w-full rounded-lg bg-rose-600 px-4 text-sm font-semibold text-white hover:bg-rose-700">
              {actionLoading ? "Rejecting..." : "Reject Request"}
            </Button>
          </div>
        </Modal>
      )}

      {deleteOpen && (
        <Modal title="Delete access request" onClose={() => setDeleteOpen(false)}>
          <div className="space-y-4">
            <p className="text-sm leading-6 text-slate-600">
              Only rejected, withdrawn, or spam records should be deleted. Approved requests are retained for auditability.
            </p>
            <Button disabled={actionLoading} onClick={deleteRequest} className="h-11 w-full rounded-lg bg-rose-600 px-4 text-sm font-semibold text-white hover:bg-rose-700">
              {actionLoading ? "Deleting..." : "Delete Request"}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
};

const DateFilter: React.FC<{
  label: string;
  value: string;
  onSelect: (value: string) => void;
}> = ({ label, value, onSelect }) => (
  <DropdownMenu>
    <DropdownMenuTrigger
      render={
        <Button className="h-[42px] w-full justify-start rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700 hover:bg-white dark:border-tail-dark-border dark:bg-tail-dark-bg dark:text-slate-300">
          <CalendarIcon className="h-4 w-4 text-slate-400" />
          <span className={value ? "text-slate-700 dark:text-slate-300" : "text-slate-400"}>
            {label}: {formatFilterDate(value)}
          </span>
        </Button>
      }
    />
    <DropdownMenuContent className="p-0" align="end">
      <Calendar selected={value} onSelect={onSelect} />
      {value && (
        <div className="border-t border-slate-100 p-2 dark:border-tail-dark-border">
          <Button
            type="button"
            onClick={() => onSelect("")}
            className="h-9 w-full rounded-md text-sm font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Clear {label.toLowerCase()}
          </Button>
        </div>
      )}
    </DropdownMenuContent>
  </DropdownMenu>
);

const Info: React.FC<{ label: string; value: string; block?: boolean }> = ({ label, value, block = false }) => (
  <div className={block ? "rounded-lg border border-slate-200 p-3 dark:border-tail-dark-border" : ""}>
    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
    <p className="mt-1 break-words text-sm font-medium text-slate-800 dark:text-slate-100">{value}</p>
  </div>
);

const Modal: React.FC<{ title: string; children: React.ReactNode; onClose: () => void }> = ({
  title,
  children,
  onClose,
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs">
    <div className="w-full max-w-lg overflow-hidden rounded-lg border border-tail-border bg-white shadow-xl dark:border-tail-dark-border dark:bg-tail-dark-card">
      <div className="flex items-center justify-between border-b border-tail-border px-6 py-4 dark:border-tail-dark-border">
        <h3 className="text-lg font-bold text-slate-950 dark:text-white">{title}</h3>
        <Button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
          <X className="h-5 w-5" />
        </Button>
      </div>
      <div className="p-6">{children}</div>
    </div>
  </div>
);
