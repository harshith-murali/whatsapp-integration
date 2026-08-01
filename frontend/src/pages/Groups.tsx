import React, { useState, useEffect } from "react";
import { api } from "../api/index.js";
import { useAuth } from "../context/AuthContext.js";
import { hasPermission } from "../utils/permissions.js";
import {
  Plus,
  Search,
  Users,
  Edit2,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  UserMinus,
} from "lucide-react";

interface Group {
  id: number;
  name: string;
  description: string | null;
  memberCount: number;
  createdBy: { id: number; name: string };
  createdAt: string;
}

interface Member {
  id: number;
  subscriber: {
    id: number;
    name: string | null;
    phoneNumber: string;
    status: string;
    optedIn: boolean;
  };
  addedBy: { id: number; name: string } | null;
  createdAt: string;
}

export const Groups: React.FC = () => {
  const { admin } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination & Search
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);

  // Group Details View state
  const [activeGroupView, setActiveGroupView] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersPage, setMembersPage] = useState(1);
  const [membersTotalPages, setMembersTotalPages] = useState(1);
  const [membersSearch, setMembersSearch] = useState("");

  // Form states
  const [groupName, setGroupName] = useState("");
  const [groupDesc, setGroupDesc] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Membership modal search state
  const [addSubModalOpen, setAddSubModalOpen] = useState(false);
  const [subSearch, setSubSearch] = useState("");
  const [subSearchResults, setSubSearchResults] = useState<any[]>([]);
  const [subSearchLoading, setSubSearchLoading] = useState(false);

  // RBAC checks
  const canCreate = hasPermission(admin?.role, "groups.create");
  const canUpdate = hasPermission(admin?.role, "groups.update");
  const canDelete = hasPermission(admin?.role, "groups.delete");
  const canManageMembers = hasPermission(admin?.role, "groups.members.manage");

  const fetchGroups = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`/groups?page=${page}&search=${search}`);
      if (response.data?.success) {
        setGroups(response.data.data.groups);
        setTotalPages(response.data.data.totalPages);
        setTotal(response.data.data.total);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load groups");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, [page]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchGroups();
  };

  // Fetch members inside Group Details
  const fetchGroupMembers = async (groupId: number, pageNum: number = 1, searchQuery: string = "") => {
    try {
      setMembersLoading(true);
      const response = await api.get(
        `/groups/${groupId}/members?page=${pageNum}&search=${searchQuery}`
      );
      if (response.data?.success) {
        setMembers(response.data.data.members);
        setMembersTotalPages(response.data.data.totalPages);
        setMembersPage(response.data.data.page);
      }
    } catch (err) {
      console.error("Failed to load group members", err);
    } finally {
      setMembersLoading(false);
    }
  };

  useEffect(() => {
    if (activeGroupView) {
      fetchGroupMembers(activeGroupView.id, membersPage, membersSearch);
    }
  }, [activeGroupView?.id, membersPage]);

  const handleMemberSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMembersPage(1);
    if (activeGroupView) {
      fetchGroupMembers(activeGroupView.id, 1, membersSearch);
    }
  };

  const openCreateModal = () => {
    setGroupName("");
    setGroupDesc("");
    setFormError(null);
    setCreateModalOpen(true);
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormLoading(true);
    try {
      const response = await api.post("/groups", {
        name: groupName,
        description: groupDesc,
      });
      if (response.data?.success) {
        setCreateModalOpen(false);
        fetchGroups();
      }
    } catch (err: any) {
      setFormError(err.response?.data?.message || "Failed to create group");
    } finally {
      setFormLoading(false);
    }
  };

  const openEditModal = (group: Group) => {
    setSelectedGroup(group);
    setGroupName(group.name);
    setGroupDesc(group.description || "");
    setFormError(null);
    setEditModalOpen(true);
  };

  const handleEditGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup) return;
    setFormError(null);
    setFormLoading(true);
    try {
      const response = await api.patch(`/groups/${selectedGroup.id}`, {
        name: groupName,
        description: groupDesc,
      });
      if (response.data?.success) {
        setEditModalOpen(false);
        fetchGroups();
        if (activeGroupView?.id === selectedGroup.id) {
          setActiveGroupView({
            ...activeGroupView,
            name: groupName,
            description: groupDesc,
          });
        }
      }
    } catch (err: any) {
      setFormError(err.response?.data?.message || "Failed to update group");
    } finally {
      setFormLoading(false);
    }
  };

  const openDeleteConfirm = (group: Group) => {
    setSelectedGroup(group);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteGroup = async () => {
    if (!selectedGroup) return;
    setFormLoading(true);
    try {
      const response = await api.delete(`/groups/${selectedGroup.id}`);
      if (response.data?.success) {
        setDeleteConfirmOpen(false);
        fetchGroups();
        if (activeGroupView?.id === selectedGroup.id) {
          setActiveGroupView(null);
        }
      }
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to delete group");
    } finally {
      setFormLoading(false);
    }
  };

  // Search subscribers outside group to add
  const searchSubscribersToAdd = async () => {
    if (!subSearch.trim()) return;
    try {
      setSubSearchLoading(true);
      const response = await api.get(`/subscribers?search=${subSearch}&limit=5`);
      if (response.data?.success) {
        // Exclude subscribers who are already members
        const currentMemberIds = new Set(members.map((m) => m.subscriber.id));
        const filtered = response.data.data.subscribers.filter(
          (sub: any) => !currentMemberIds.has(sub.id)
        );
        setSubSearchResults(filtered);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubSearchLoading(false);
    }
  };

  const handleAddMember = async (subscriberId: number) => {
    if (!activeGroupView) return;
    try {
      const response = await api.post(`/groups/${activeGroupView.id}/subscribers`, {
        subscriberId,
      });
      if (response.data?.success) {
        setAddSubModalOpen(false);
        setSubSearch("");
        setSubSearchResults([]);
        fetchGroupMembers(activeGroupView.id, 1, membersSearch);
        // Refresh group count in list
        fetchGroups();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to add member");
    }
  };

  const handleRemoveMember = async (subscriberId: number) => {
    if (!activeGroupView) return;
    if (!window.confirm("Remove subscriber from this group?")) return;
    try {
      const response = await api.delete(
        `/groups/${activeGroupView.id}/subscribers/${subscriberId}`
      );
      if (response.data?.success) {
        fetchGroupMembers(activeGroupView.id, 1, membersSearch);
        fetchGroups();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to remove member");
    }
  };

  return (
    <>
      <div className="space-y-6 animate-fade-in">
        {/* Header Title */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Recipient Groups
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Organize subscribers into logical groups for targeted broadcast alerts.
            </p>
          </div>
          {canCreate && (
            <button
              onClick={openCreateModal}
              className="inline-flex items-center justify-center px-4.5 py-2.5 rounded-lg bg-indigo-600 text-white font-semibold text-sm shadow-md hover:bg-indigo-700 transition-colors cursor-pointer"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Group
            </button>
          )}
        </div>

        {/* Layout: Groups List + Details Pane */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Left Column: Groups List */}
          <div className="lg:col-span-2 space-y-4">
            {/* Search filter */}
            <div className="bg-white p-4 rounded-lg border border-tail-border shadow-xs dark:bg-tail-dark-card dark:border-tail-dark-border">
              <form onSubmit={handleSearchSubmit} className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <Search className="h-4 w-4" />
                  </span>
                  <input
                    type="text"
                    placeholder="Search groups..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="block w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-hidden dark:border-tail-dark-border dark:bg-tail-dark-bg dark:text-white"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-lg transition-colors cursor-pointer"
                >
                  Search
                </button>
              </form>
            </div>

            {loading ? (
              <div className="flex h-48 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
              </div>
            ) : error ? (
              <div className="rounded-lg bg-red-50 p-6 text-red-700 dark:bg-red-950/30 dark:text-red-400 border border-red-100 dark:border-red-900/50">
                <p className="font-semibold">Failed to fetch groups</p>
                <p className="text-sm mt-1">{error}</p>
              </div>
            ) : groups.length === 0 ? (
              <div className="rounded-lg bg-white border border-tail-border p-12 text-center dark:bg-tail-dark-card dark:border-tail-dark-border">
                <Users className="h-10 w-10 text-slate-400 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-800 dark:text-white">No Groups Found</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                  Create a recipient group to get started organizing your notification list.
                </p>
              </div>
            ) : (
              <div className="rounded-lg bg-white shadow-xs border border-tail-border dark:bg-tail-dark-card dark:border-tail-dark-border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 text-xs uppercase font-semibold border-b border-tail-border dark:border-tail-dark-border">
                        <th className="px-5 py-4">Group Name</th>
                        <th className="px-5 py-4">Description</th>
                        <th className="px-5 py-4">Members</th>
                        <th className="px-5 py-4">Created By</th>
                        <th className="px-5 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-tail-border dark:divide-tail-dark-border text-sm">
                      {groups.map((group) => {
                        const isViewing = activeGroupView?.id === group.id;
                        return (
                          <tr
                            key={group.id}
                            className={`hover:bg-slate-50/40 dark:hover:bg-slate-800/10 transition-colors cursor-pointer ${
                              isViewing ? "bg-indigo-50/30 dark:bg-indigo-950/10" : ""
                            }`}
                            onClick={() => {
                              setActiveGroupView(group);
                              setMembersPage(1);
                              fetchGroupMembers(group.id, 1, "");
                            }}
                          >
                            <td className="px-5 py-4 font-bold text-slate-900 dark:text-white">
                              {group.name}
                            </td>
                            <td className="px-5 py-4 text-slate-500 dark:text-slate-400 max-w-xs truncate">
                              {group.description || <span className="text-slate-300 italic">No description</span>}
                            </td>
                            <td className="px-5 py-4">
                              <span className="inline-flex items-center px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-xs font-semibold dark:bg-indigo-950/20 dark:text-indigo-400">
                                {group.memberCount} members
                              </span>
                            </td>
                            <td className="px-5 py-4 text-slate-500 dark:text-slate-400">
                              {group.createdBy.name}
                            </td>
                            <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex justify-end space-x-2">
                                {canUpdate && (
                                  <button
                                    onClick={() => openEditModal(group)}
                                    className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-indigo-600 dark:hover:bg-slate-800 dark:text-slate-400"
                                    title="Edit Group"
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </button>
                                )}
                                {canDelete && (
                                  <button
                                    onClick={() => openDeleteConfirm(group)}
                                    className="p-1 hover:bg-red-50 rounded text-slate-500 hover:text-red-600 dark:hover:bg-red-950/20 dark:text-slate-400"
                                    title="Delete Group"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Left side pagination */}
                {totalPages > 1 && (
                  <div className="px-5 py-4 border-t border-tail-border dark:border-tail-dark-border flex items-center justify-between">
                    <span className="text-xs text-slate-400">
                      Page {page} of {totalPages} ({total} groups)
                    </span>
                    <div className="flex space-x-2">
                      <button
                        disabled={page <= 1}
                        onClick={() => setPage(page - 1)}
                        className="p-1 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        disabled={page >= totalPages}
                        onClick={() => setPage(page + 1)}
                        className="p-1 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Column: Group Details view */}
          <div className="lg:col-span-1">
            {activeGroupView ? (
              <div className="rounded-lg border border-white/80 bg-white/95 shadow-xs p-5 dark:border-tail-dark-border dark:bg-tail-dark-card space-y-4">
                <div className="flex justify-between items-start border-b border-tail-border dark:border-tail-dark-border pb-3">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                      {activeGroupView.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {activeGroupView.description || "No description provided"}
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveGroupView(null)}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Member Search list inside details */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Group Members ({members.length})
                    </span>
                    {canManageMembers && (
                      <button
                        onClick={() => setAddSubModalOpen(true)}
                        className="inline-flex items-center text-xs font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" /> Add Member
                      </button>
                    )}
                  </div>

                  <form onSubmit={handleMemberSearchSubmit} className="flex gap-1.5">
                    <input
                      type="text"
                      placeholder="Search member name..."
                      value={membersSearch}
                      onChange={(e) => setMembersSearch(e.target.value)}
                      className="block flex-1 rounded border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs focus:outline-hidden focus:bg-white dark:border-tail-dark-border dark:bg-tail-dark-bg dark:text-white"
                    />
                    <button
                      type="submit"
                      className="px-2.5 py-1.5 bg-indigo-600 text-white rounded text-xs font-semibold cursor-pointer"
                    >
                      Filter
                    </button>
                  </form>

                  {membersLoading ? (
                    <div className="flex h-32 items-center justify-center">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent"></div>
                    </div>
                  ) : members.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-6 text-center">
                      No members matching criteria found.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                      {members.map((member) => (
                        <div
                          key={member.id}
                          className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded border border-slate-100 dark:border-tail-dark-border/40"
                        >
                          <div>
                            <p className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                              {member.subscriber.name || "(No Name)"}
                            </p>
                            <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                              {member.subscriber.phoneNumber}
                            </p>
                            <div className="flex space-x-1.5 mt-1">
                              <span className={`text-[8px] px-1 rounded-sm font-bold uppercase ${
                                member.subscriber.status === "ACTIVE"
                                  ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20"
                                  : "bg-rose-50 text-rose-600"
                              }`}>
                                {member.subscriber.status}
                              </span>
                              <span className={`text-[8px] px-1 rounded-sm font-bold uppercase ${
                                member.subscriber.optedIn
                                  ? "bg-indigo-50 text-indigo-600"
                                  : "bg-slate-100 text-slate-500"
                              }`}>
                                {member.subscriber.optedIn ? "Consented" : "No consent"}
                              </span>
                            </div>
                          </div>

                          {canManageMembers && (
                            <button
                              onClick={() => handleRemoveMember(member.subscriber.id)}
                              className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                              title="Remove Member"
                            >
                              <UserMinus className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Right side pagination */}
                  {membersTotalPages > 1 && (
                    <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-850">
                      <span className="text-[10px] text-slate-400">Page {membersPage} of {membersTotalPages}</span>
                      <div className="flex space-x-1">
                        <button
                          disabled={membersPage <= 1}
                          onClick={() => setMembersPage(membersPage - 1)}
                          className="p-0.5 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
                        >
                          <ChevronLeft className="h-3 w-3" />
                        </button>
                        <button
                          disabled={membersPage >= membersTotalPages}
                          onClick={() => setMembersPage(membersPage + 1)}
                          className="p-0.5 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
                        >
                          <ChevronRight className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-slate-200 border-dashed p-6 text-center text-slate-400 dark:border-tail-dark-border dark:text-slate-500">
                <Users className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                <p className="text-xs">Select a group from the list to view members and details.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CREATE MODAL */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white dark:bg-tail-dark-card rounded-lg shadow-xl border border-tail-border dark:border-tail-dark-border overflow-hidden animate-zoom-in">
            <div className="px-6 py-5 border-b border-tail-border dark:border-tail-dark-border flex justify-between items-center bg-slate-50 dark:bg-tail-dark-card">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Create Recipient Group
              </h3>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateGroup}>
              <div className="p-6 space-y-4">
                {formError && (
                  <div className="rounded-lg bg-red-50 p-4 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-400 border border-red-100 dark:border-red-900/50">
                    {formError}
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                    Group Name
                  </label>
                  <input
                    type="text"
                    required
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="e.g. Beta Testers List"
                    className="block w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-hidden dark:border-tail-dark-border dark:bg-tail-dark-bg dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                    Description (Optional)
                  </label>
                  <textarea
                    rows={3}
                    value={groupDesc}
                    onChange={(e) => setGroupDesc(e.target.value)}
                    placeholder="Brief details about members in this target group"
                    className="block w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-hidden dark:border-tail-dark-border dark:bg-tail-dark-bg dark:text-white"
                  />
                </div>
              </div>

              <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/40 border-t border-tail-border dark:border-tail-dark-border flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2.5 rounded-lg text-slate-500 bg-transparent hover:bg-slate-100 text-sm font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-4 py-2.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-sm font-semibold shadow-md disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {formLoading ? "Saving..." : "Create Group"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editModalOpen && selectedGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white dark:bg-tail-dark-card rounded-lg shadow-xl border border-tail-border dark:border-tail-dark-border overflow-hidden animate-zoom-in">
            <div className="px-6 py-5 border-b border-tail-border dark:border-tail-dark-border flex justify-between items-center bg-slate-50 dark:bg-tail-dark-card">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Edit Group Properties
              </h3>
              <button
                onClick={() => setEditModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleEditGroup}>
              <div className="p-6 space-y-4">
                {formError && (
                  <div className="rounded-lg bg-red-50 p-4 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-400 border border-red-100 dark:border-red-900/50">
                    {formError}
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                    Group Name
                  </label>
                  <input
                    type="text"
                    required
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="e.g. Beta Testers List"
                    className="block w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-hidden dark:border-tail-dark-border dark:bg-tail-dark-bg dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                    Description (Optional)
                  </label>
                  <textarea
                    rows={3}
                    value={groupDesc}
                    onChange={(e) => setGroupDesc(e.target.value)}
                    placeholder="Brief details about members in this target group"
                    className="block w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-hidden dark:border-tail-dark-border dark:bg-tail-dark-bg dark:text-white"
                  />
                </div>
              </div>

              <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/40 border-t border-tail-border dark:border-tail-dark-border flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2.5 rounded-lg text-slate-500 bg-transparent hover:bg-slate-100 text-sm font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-4 py-2.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-sm font-semibold shadow-md disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {formLoading ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM */}
      {deleteConfirmOpen && selectedGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white dark:bg-tail-dark-card rounded-lg shadow-xl border border-tail-border dark:border-tail-dark-border overflow-hidden animate-zoom-in">
            <div className="p-6">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Delete Recipient Group?
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                Are you sure you want to permanently delete the group{" "}
                <strong className="text-slate-800 dark:text-white">
                  {selectedGroup.name}
                </strong>
                ? Deletion will fail if any active broadcast currently targets this group.
              </p>
            </div>
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/40 border-t border-tail-border dark:border-tail-dark-border flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(false)}
                className="px-4 py-2.5 rounded-lg text-slate-500 bg-transparent hover:bg-slate-100 text-sm font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteGroup}
                disabled={formLoading}
                className="px-4 py-2.5 rounded-lg bg-red-600 text-white hover:bg-red-700 text-sm font-semibold shadow-md disabled:opacity-50 transition-colors cursor-pointer"
              >
                {formLoading ? "Deleting..." : "Delete Group"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD SUBSCRIBER TO GROUP MODAL */}
      {addSubModalOpen && activeGroupView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white dark:bg-tail-dark-card rounded-lg shadow-xl border border-tail-border dark:border-tail-dark-border overflow-hidden animate-zoom-in">
            <div className="px-6 py-5 border-b border-tail-border dark:border-tail-dark-border flex justify-between items-center bg-slate-50 dark:bg-tail-dark-card">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Add Member to Group
              </h3>
              <button
                onClick={() => {
                  setAddSubModalOpen(false);
                  setSubSearch("");
                  setSubSearchResults([]);
                }}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Search subscriber name or phone..."
                  value={subSearch}
                  onChange={(e) => setSubSearch(e.target.value)}
                  className="block flex-1 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-hidden dark:border-tail-dark-border dark:bg-tail-dark-bg dark:text-white"
                />
                <button
                  onClick={searchSubscribersToAdd}
                  disabled={subSearchLoading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-lg transition-colors cursor-pointer"
                >
                  Search
                </button>
              </div>

              {subSearchLoading ? (
                <div className="flex justify-center py-4">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent"></div>
                </div>
              ) : subSearchResults.length === 0 && subSearch.trim() ? (
                <p className="text-xs text-slate-400 italic text-center py-2">
                  No eligible subscribers found outside group.
                </p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {subSearchResults.map((sub) => (
                    <div
                      key={sub.id}
                      className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/40 rounded border border-slate-100 dark:border-tail-dark-border/40"
                    >
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white">
                          {sub.name || "(No Name)"}
                        </p>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                          {sub.phoneNumber}
                        </p>
                      </div>
                      <button
                        onClick={() => handleAddMember(sub.id)}
                        className="inline-flex items-center justify-center px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold transition-colors cursor-pointer"
                      >
                        <UserPlus className="h-3 w-3 mr-1" /> Add
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
export default Groups;
