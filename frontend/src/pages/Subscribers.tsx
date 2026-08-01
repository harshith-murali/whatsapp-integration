import React, { useState, useEffect } from "react";
import { api } from "../api/index.js";
import { useAuth } from "../context/AuthContext.js";
import { useLocation } from "react-router-dom";
import { hasPermission } from "../utils/permissions.js";
import { countryCodes, splitPhoneNumber } from "../utils/countryCodes.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu.js";
import { SelectMenu } from "../components/ui/select-menu.js";
import { Button } from "../components/ui/button.js";
import {
  Plus,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Edit2,
  Trash2,
  X,
  UserPlus,
} from "lucide-react";

interface Subscriber {
  id: number;
  name: string | null;
  phoneNumber: string;
  countryCode?: string | null;
  status: "ACTIVE" | "UNSUBSCRIBED" | "BLOCKED";
  optedIn: boolean;
  optedInAt: string | null;
  unsubscribedAt: string | null;
  createdAt: string;
}

export const Subscribers: React.FC = () => {
  const { admin } = useAuth();
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination & Filtering state
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [optedIn, setOptedIn] = useState("");

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Form states
  const [selectedSub, setSelectedSub] = useState<Subscriber | null>(null);
  const [subName, setSubName] = useState("");
  const [subCountryCode, setSubCountryCode] = useState("+91");
  const [subPhone, setSubPhone] = useState("");
  const [subStatus, setSubStatus] = useState<"ACTIVE" | "UNSUBSCRIBED" | "BLOCKED">("ACTIVE");
  const [subOptedIn, setSubOptedIn] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  const fetchSubscribers = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = { page, limit };
      if (search) params.search = search;
      if (status) params.status = status;
      if (optedIn) params.optedIn = optedIn;

      const response = await api.get("/subscribers", { params });
      if (response.data?.success) {
        setSubSubscribers(response.data.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load subscribers.");
    } finally {
      setLoading(false);
    }
  };

  const setSubSubscribers = (data: any) => {
    setSubscribers(data.subscribers);
    setPage(data.page);
    setTotal(data.total);
    setTotalPages(data.totalPages);
  };

  useEffect(() => {
    fetchSubscribers();
  }, [page, status, optedIn]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchSubscribers();
  };

  const location = useLocation();

  const canCreate = hasPermission(admin?.role, "subscribers.create");
  const canUpdate = hasPermission(admin?.role, "subscribers.update");
  const canDelete = hasPermission(admin?.role, "subscribers.delete");
  const showActionsColumn = canUpdate || canDelete;
  const selectedCountry = countryCodes.find((country) => country.code === subCountryCode) || countryCodes[0];
  const subscriberStatusOptions = [
    { value: "ACTIVE", label: "ACTIVE" },
    { value: "UNSUBSCRIBED", label: "UNSUBSCRIBED" },
    { value: "BLOCKED", label: "BLOCKED" },
  ];
  const filterStatusOptions = [{ value: "", label: "All Statuses" }, ...subscriberStatusOptions];
  const optInFilterOptions = [
    { value: "", label: "All Opt-ins" },
    { value: "true", label: "Opted In Only" },
    { value: "false", label: "Opted Out Only" },
  ];
  const optInOptions = [
    { value: "true", label: "Opted In" },
    { value: "false", label: "Opted Out" },
  ];

  const CountryCodePicker = () => (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex h-[42px] w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 transition-colors hover:border-indigo-200 hover:bg-white focus:border-indigo-500 focus:bg-white focus:outline-hidden dark:border-tail-dark-border dark:bg-tail-dark-bg dark:text-slate-200">
        <span className="flex min-w-0 items-center gap-2">
          <span className="text-xs text-slate-400">{selectedCountry.iso}</span>
          <span>{selectedCountry.code}</span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="max-h-72 w-72 overflow-y-auto" align="start">
        <DropdownMenuLabel>Country code</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {countryCodes.map((country) => (
            <DropdownMenuItem
              key={`${country.iso}-${country.code}`}
              onSelect={() => setSubCountryCode(country.code)}
              className={country.code === subCountryCode ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300" : ""}
            >
              <span className="min-w-0 truncate">
                <span className="mr-2 font-bold text-slate-400">{country.iso}</span>
                {country.name}
              </span>
              <DropdownMenuShortcut>{country.code}</DropdownMenuShortcut>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("add") === "true" && canCreate) {
      // Clear the query parameter so modal doesn't re-open on state update
      window.history.replaceState({}, document.title, window.location.pathname);
      openCreateModal();
    }
  }, [location.search, canCreate]);

  const openCreateModal = () => {
    setSubName("");
    setSubCountryCode("+91");
    setSubPhone("");
    setSubStatus("ACTIVE");
    setSubOptedIn(true);
    setFormError(null);
    setCreateModalOpen(true);
  };

  const handleCreateSubscriber = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormLoading(true);
    try {
      const response = await api.post("/subscribers", {
        name: subName || null,
        countryCode: subCountryCode,
        phoneNumber: subPhone,
        status: subStatus,
        optedIn: subOptedIn,
      });
      if (response.data?.success) {
        setCreateModalOpen(false);
        fetchSubscribers();
      }
    } catch (err: any) {
      setFormError(err.response?.data?.message || "Failed to create subscriber.");
    } finally {
      setFormLoading(false);
    }
  };

  const openEditModal = (sub: Subscriber) => {
    setSelectedSub(sub);
    const splitPhone = splitPhoneNumber(sub.phoneNumber, sub.countryCode || "+91");
    setSubName(sub.name || "");
    setSubCountryCode(sub.countryCode || splitPhone.countryCode);
    setSubPhone(splitPhone.nationalNumber);
    setSubStatus(sub.status);
    setSubOptedIn(sub.optedIn);
    setFormError(null);
    setEditModalOpen(true);
  };

  const handleEditSubscriber = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSub) return;
    setFormError(null);
    setFormLoading(true);
    try {
      const response = await api.patch(`/subscribers/${selectedSub.id}`, {
        name: subName || null,
        countryCode: subCountryCode,
        phoneNumber: subPhone,
        status: subStatus,
        optedIn: subOptedIn,
      });
      if (response.data?.success) {
        setEditModalOpen(false);
        fetchSubscribers();
      }
    } catch (err: any) {
      setFormError(err.response?.data?.message || "Failed to update subscriber.");
    } finally {
      setFormLoading(false);
    }
  };

  const openDeleteConfirm = (sub: Subscriber) => {
    setSelectedSub(sub);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteSubscriber = async () => {
    if (!selectedSub) return;
    setFormLoading(true);
    try {
      await api.delete(`/subscribers/${selectedSub.id}`);
      setDeleteConfirmOpen(false);
      fetchSubscribers();
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to delete subscriber.");
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Subscribers Database
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage customer WhatsApp opt-ins and messaging status.
          </p>
        </div>
        {canCreate && (
          <Button
            onClick={openCreateModal}
            className="inline-flex items-center justify-center px-4.5 py-2.5 rounded-lg bg-indigo-600 text-white font-semibold text-sm shadow-md hover:bg-indigo-700 transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Subscriber
          </Button>
        )}
      </div>

      {/* Filter bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-lg border border-tail-border shadow-xs dark:bg-tail-dark-card dark:border-tail-dark-border">
        <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2">
          <div className="relative flex-1 max-w-md">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <Search className="h-4 w-4" />
            </span>
            <input
              type="text"
              placeholder={
                admin?.role === "VIEWER"
                  ? "Search by name only..."
                  : "Search by name or phone..."
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="block w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-4 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-hidden dark:border-tail-dark-border dark:bg-tail-dark-bg dark:text-white"
            />
          </div>
          <Button
            type="submit"
            className="px-4 py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-sm font-semibold transition-colors cursor-pointer"
          >
            Search
          </Button>
        </form>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Filters:
            </span>
          </div>

          <SelectMenu
            value={status}
            options={filterStatusOptions}
            onValueChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
            label="Status"
            className="w-44"
            contentClassName="w-48"
          />

          <SelectMenu
            value={optedIn}
            options={optInFilterOptions}
            onValueChange={(value) => {
              setOptedIn(value);
              setPage(1);
            }}
            label="Opt-in"
            className="w-44"
            contentClassName="w-48"
          />
        </div>
      </div>

      {/* Database Results */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
        </div>
      ) : error ? (
        <div className="rounded-lg bg-red-50 p-6 text-red-700 dark:bg-red-950/30 dark:text-red-400 border border-red-100 dark:border-red-900/50">
          <p className="font-semibold">Failed to fetch subscribers</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      ) : (
        <div className="rounded-lg bg-white shadow-xs border border-tail-border dark:bg-tail-dark-card dark:border-tail-dark-border overflow-hidden animate-fade-in">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 text-xs uppercase font-semibold border-b border-tail-border dark:border-tail-dark-border">
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Phone Number</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Opt In</th>
                  <th className="px-6 py-4">Created At</th>
                  {showActionsColumn && <th className="px-6 py-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-tail-border dark:divide-tail-dark-border text-sm">
                {subscribers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={showActionsColumn ? 6 : 5}
                      className="px-6 py-12 text-center text-slate-400 dark:text-slate-500"
                    >
                      No subscribers found matching the filters.
                    </td>
                  </tr>
                ) : (
                  subscribers.map((sub) => (
                    <tr
                      key={sub.id}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors"
                    >
                      <td className="px-6 py-4 font-semibold text-slate-950 dark:text-slate-200">
                        {sub.name || <span className="text-slate-400 italic font-normal">No name provided</span>}
                      </td>
                      <td className="px-6 py-4 font-mono text-slate-600 dark:text-slate-400">
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
                      <td className="px-6 py-4">
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
                      <td className="px-6 py-4">
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
                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                        {new Date(sub.createdAt).toLocaleDateString()}
                      </td>
                      {showActionsColumn && (
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end space-x-2">
                            {canUpdate && (
                              <Button
                                onClick={() => openEditModal(sub)}
                                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                                title="Edit Subscriber"
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                            )}
                            {canDelete && (
                              <Button
                                onClick={() => openDeleteConfirm(sub)}
                                className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 transition-colors cursor-pointer"
                                title="Delete Subscriber"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {totalPages > 1 && (
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/40 border-t border-tail-border dark:border-tail-dark-border flex items-center justify-between">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Showing page <strong className="text-slate-900 dark:text-white">{page}</strong> of{" "}
                <strong className="text-slate-900 dark:text-white">{totalPages}</strong> ({total} total records)
              </span>
              <div className="flex space-x-2">
                <Button
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 dark:border-tail-dark-border dark:hover:bg-slate-700 disabled:opacity-40 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 dark:border-tail-dark-border dark:hover:bg-slate-700 disabled:opacity-40 transition-colors cursor-pointer"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
      </div>

      {/* CREATE MODAL */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg bg-white dark:bg-tail-dark-card rounded-lg shadow-xl border border-tail-border dark:border-tail-dark-border overflow-hidden animate-zoom-in">
            <div className="px-6 py-5 border-b border-tail-border dark:border-tail-dark-border flex justify-between items-center bg-slate-50 dark:bg-tail-dark-card">
              <div className="flex items-center">
                <UserPlus className="h-5 w-5 text-indigo-500 mr-2" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Add New Subscriber
                </h3>
              </div>
              <Button
                onClick={() => setCreateModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <form onSubmit={handleCreateSubscriber}>
              <div className="p-6 space-y-4">
                {formError && (
                  <div className="rounded-lg bg-red-50 p-4 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-400 border border-red-100 dark:border-red-900/50">
                    {formError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                    Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={subName}
                    onChange={(e) => setSubName(e.target.value)}
                    placeholder="John Doe"
                    className="block w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-hidden dark:border-tail-dark-border dark:bg-tail-dark-bg dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                    Phone Number (Required)
                  </label>
                  <div className="grid grid-cols-[156px_minmax(0,1fr)] gap-2">
                    <CountryCodePicker />
                    <input
                      type="tel"
                      required
                      value={subPhone}
                      onChange={(e) => setSubPhone(e.target.value)}
                      placeholder="98765 43210"
                      className="block w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-hidden dark:border-tail-dark-border dark:bg-tail-dark-bg dark:text-white"
                    />
                  </div>
                  <p className="text-xs text-slate-400 mt-1.5">
                    Saved as a full WhatsApp number in the database, for example {subCountryCode.replace("+", "")}9876543210.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                      Status
                    </label>
                    <SelectMenu
                      value={subStatus}
                      options={subscriberStatusOptions}
                      onValueChange={(value) =>
                        setSubStatus(value as "ACTIVE" | "UNSUBSCRIBED" | "BLOCKED")
                      }
                      label="Status"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                      Opted In (Opt-in State)
                    </label>
                    <SelectMenu
                      value={subOptedIn ? "true" : "false"}
                      options={optInOptions}
                      onValueChange={(value) => setSubOptedIn(value === "true")}
                      label="Opt-in state"
                    />
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/40 border-t border-tail-border dark:border-tail-dark-border flex justify-end space-x-2">
                <Button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2.5 rounded-lg text-slate-500 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={formLoading}
                  className="px-4 py-2.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-sm font-semibold shadow-md disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {formLoading ? "Saving..." : "Add Subscriber"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editModalOpen && selectedSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg bg-white dark:bg-tail-dark-card rounded-lg shadow-xl border border-tail-border dark:border-tail-dark-border overflow-hidden animate-zoom-in">
            <div className="px-6 py-5 border-b border-tail-border dark:border-tail-dark-border flex justify-between items-center bg-slate-50 dark:bg-tail-dark-card">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Edit Subscriber Details
              </h3>
              <Button
                onClick={() => setEditModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <form onSubmit={handleEditSubscriber}>
              <div className="p-6 space-y-4">
                {formError && (
                  <div className="rounded-lg bg-red-50 p-4 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-400 border border-red-100 dark:border-red-900/50">
                    {formError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                    Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={subName}
                    onChange={(e) => setSubName(e.target.value)}
                    placeholder="John Doe"
                    className="block w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-hidden dark:border-tail-dark-border dark:bg-tail-dark-bg dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                    Phone Number (Required)
                  </label>
                  <div className="grid grid-cols-[156px_minmax(0,1fr)] gap-2">
                    <CountryCodePicker />
                    <input
                      type="tel"
                      required
                      value={subPhone}
                      onChange={(e) => setSubPhone(e.target.value)}
                      placeholder="98765 43210"
                      className="block w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-hidden dark:border-tail-dark-border dark:bg-tail-dark-bg dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                      Status
                    </label>
                    <SelectMenu
                      value={subStatus}
                      options={subscriberStatusOptions}
                      onValueChange={(value) =>
                        setSubStatus(value as "ACTIVE" | "UNSUBSCRIBED" | "BLOCKED")
                      }
                      label="Status"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                      Opted In (Opt-in State)
                    </label>
                    <SelectMenu
                      value={subOptedIn ? "true" : "false"}
                      options={optInOptions}
                      onValueChange={(value) => setSubOptedIn(value === "true")}
                      label="Opt-in state"
                    />
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/40 border-t border-tail-border dark:border-tail-dark-border flex justify-end space-x-2">
                <Button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2.5 rounded-lg text-slate-500 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={formLoading}
                  className="px-4 py-2.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-sm font-semibold shadow-md disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {formLoading ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM */}
      {deleteConfirmOpen && selectedSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white dark:bg-tail-dark-card rounded-lg shadow-xl border border-tail-border dark:border-tail-dark-border overflow-hidden animate-zoom-in">
            <div className="p-6">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Delete Subscriber?
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                Are you sure you want to permanently delete{" "}
                <strong className="text-slate-800 dark:text-white">
                  {selectedSub.name || selectedSub.phoneNumber}
                </strong>
                ? This action cannot be undone.
              </p>
            </div>
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/40 border-t border-tail-border dark:border-tail-dark-border flex justify-end space-x-2">
              <Button
                type="button"
                onClick={() => setDeleteConfirmOpen(false)}
                className="px-4 py-2.5 rounded-lg text-slate-500 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                onClick={handleDeleteSubscriber}
                disabled={formLoading}
                className="px-4 py-2.5 rounded-lg bg-red-600 text-white hover:bg-red-700 text-sm font-semibold shadow-md disabled:opacity-50 transition-colors cursor-pointer"
              >
                {formLoading ? "Deleting..." : "Delete Permanently"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
