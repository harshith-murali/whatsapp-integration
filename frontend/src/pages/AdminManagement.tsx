import React, { useState, useEffect } from "react";
import { api } from "../api/index.js";
import { useAuth } from "../context/AuthContext.js";
import { SelectMenu } from "../components/ui/select-menu.js";
import { Button } from "../components/ui/button.js";
import {
  Plus,
  Edit2,
  Trash2,
  X,
  UserPlus,
  Shield,
  Power,
} from "lucide-react";

interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: "SUPER_ADMIN" | "ADMIN" | "OPERATOR" | "VIEWER";
  isActive: boolean;
  createdAt: string;
}

export const AdminManagement: React.FC = () => {
  const { admin: loggedInAdmin } = useAuth();
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Form states
  const [selectedAdmin, setSelectedAdmin] = useState<AdminUser | null>(null);
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminRole, setAdminRole] = useState<"SUPER_ADMIN" | "ADMIN" | "OPERATOR" | "VIEWER">("VIEWER");
  const [adminActive, setAdminActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const roleOptions = [
    { value: "VIEWER", label: "VIEWER" },
    { value: "OPERATOR", label: "OPERATOR" },
    { value: "ADMIN", label: "ADMIN" },
    { value: "SUPER_ADMIN", label: "SUPER ADMIN" },
  ];
  const accountStatusOptions = [
    { value: "true", label: "Active" },
    { value: "false", label: "Inactive" },
  ];

  const fetchAdmins = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get("/admins");
      if (response.data?.success) {
        setAdmins(response.data.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load admins.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const openCreateModal = () => {
    setAdminName("");
    setAdminEmail("");
    setAdminPassword("");
    setAdminRole("VIEWER");
    setAdminActive(true);
    setFormError(null);
    setCreateModalOpen(true);
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormLoading(true);
    try {
      const response = await api.post("/admins", {
        name: adminName,
        email: adminEmail,
        password: adminPassword,
        role: adminRole,
        isActive: adminActive,
      });
      if (response.data?.success) {
        setCreateModalOpen(false);
        fetchAdmins();
      }
    } catch (err: any) {
      setFormError(err.response?.data?.message || "Failed to create admin.");
    } finally {
      setFormLoading(false);
    }
  };

  const openEditModal = (admin: AdminUser) => {
    setSelectedAdmin(admin);
    setAdminName(admin.name);
    setAdminEmail(admin.email);
    setAdminPassword(""); // blank by default (only updated if provided)
    setAdminRole(admin.role);
    setAdminActive(admin.isActive);
    setFormError(null);
    setEditModalOpen(true);
  };

  const handleEditAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdmin) return;
    setFormError(null);
    setFormLoading(true);
    try {
      const payload: any = {
        name: adminName,
        email: adminEmail,
        role: adminRole,
        isActive: adminActive,
      };
      if (adminPassword.trim()) {
        payload.password = adminPassword;
      }

      const response = await api.patch(`/admins/${selectedAdmin.id}`, payload);
      if (response.data?.success) {
        setEditModalOpen(false);
        fetchAdmins();
      }
    } catch (err: any) {
      setFormError(err.response?.data?.message || "Failed to update admin.");
    } finally {
      setFormLoading(false);
    }
  };

  const toggleAdminStatus = async (admin: AdminUser) => {
    try {
      const newStatus = !admin.isActive;
      setAdmins((prev) =>
        prev.map((a) => (a.id === admin.id ? { ...a, isActive: newStatus } : a))
      );

      const response = await api.patch(`/admins/${admin.id}/status`, {
        isActive: newStatus,
      });

      if (!response.data?.success) {
        throw new Error("Failed to toggle status");
      }
    } catch (err: any) {
      setAdmins((prev) =>
        prev.map((a) => (a.id === admin.id ? { ...a, isActive: admin.isActive } : a))
      );
      alert(err.response?.data?.message || "Failed to change active status.");
    }
  };

  const openDeleteConfirm = (admin: AdminUser) => {
    setSelectedAdmin(admin);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteAdmin = async () => {
    if (!selectedAdmin) return;
    setFormLoading(true);
    try {
      await api.delete(`/admins/${selectedAdmin.id}`);
      setDeleteConfirmOpen(false);
      fetchAdmins();
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to delete admin.");
    } finally {
      setFormLoading(false);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "SUPER_ADMIN":
        return "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/20 dark:text-purple-400 dark:border-purple-900";
      case "ADMIN":
        return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900";
      case "OPERATOR":
        return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800";
    }
  };

  return (
    <>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Admin Management
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Create, update, and manage access roles for administrators.
          </p>
        </div>
        <Button
          onClick={openCreateModal}
          className="inline-flex items-center justify-center px-4.5 py-2.5 rounded-lg bg-indigo-600 text-white font-semibold text-sm shadow-md hover:bg-indigo-700 transition-colors cursor-pointer"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Admin
        </Button>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
        </div>
      ) : error ? (
        <div className="rounded-lg bg-red-50 p-6 text-red-700 dark:bg-red-950/30 dark:text-red-400 border border-red-100 dark:border-red-900/50">
          <p className="font-semibold">Failed to fetch admins</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      ) : (
        <div className="rounded-lg bg-white shadow-xs border border-tail-border dark:bg-tail-dark-card dark:border-tail-dark-border overflow-hidden animate-fade-in">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 text-xs uppercase font-semibold border-b border-tail-border dark:border-tail-dark-border">
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Created At</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-tail-border dark:divide-tail-dark-border text-sm">
                {admins.map((adm) => {
                  const isSelf = adm.id === loggedInAdmin?.id;
                  return (
                    <tr
                      key={adm.id}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors"
                    >
                      <td className="px-6 py-4 font-semibold text-slate-950 dark:text-slate-200">
                        <div className="flex items-center space-x-1.5">
                          <span>{adm.name}</span>
                          {isSelf && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/20 dark:text-indigo-400">
                              You
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-400 font-mono">
                        {adm.email}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getRoleBadgeColor(
                            adm.role
                          )}`}
                        >
                          <Shield className="h-3 w-3 mr-1" />
                          {adm.role.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <Button
                          disabled={isSelf}
                          onClick={() => toggleAdminStatus(adm)}
                          className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-colors focus:outline-hidden ${
                            adm.isActive
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/15 dark:text-emerald-400"
                              : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                          } ${isSelf ? "cursor-not-allowed opacity-75" : "hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"}`}
                          title={isSelf ? "Cannot deactivate yourself" : "Toggle active state"}
                        >
                          <Power className="h-3.5 w-3.5" />
                          <span>{adm.isActive ? "Active" : "Inactive"}</span>
                        </Button>
                      </td>
                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                        {new Date(adm.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end space-x-2">
                          <Button
                            onClick={() => openEditModal(adm)}
                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                            title="Edit Admin"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            disabled={isSelf}
                            onClick={() => openDeleteConfirm(adm)}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              isSelf
                                ? "text-slate-300 dark:text-slate-700 cursor-not-allowed"
                                : "hover:bg-red-50 text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-950/20 dark:hover:text-red-400"
                            }`}
                            title={isSelf ? "Cannot delete yourself" : "Delete Admin"}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
                  Create Admin Account
                </h3>
              </div>
              <Button
                onClick={() => setCreateModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <form onSubmit={handleCreateAdmin}>
              <div className="p-6 space-y-4">
                {formError && (
                  <div className="rounded-lg bg-red-50 p-4 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-400 border border-red-100 dark:border-red-900/50">
                    {formError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    required
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    placeholder="Jane Doe"
                    className="block w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-hidden dark:border-tail-dark-border dark:bg-tail-dark-bg dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="jane@company.com"
                    className="block w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-hidden dark:border-tail-dark-border dark:bg-tail-dark-bg dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="••••••••"
                    className="block w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-hidden dark:border-tail-dark-border dark:bg-tail-dark-bg dark:text-white"
                  />
                  <p className="text-[11px] text-slate-400 mt-1.5 leading-normal">
                    Must be at least 8 characters and contain at least one uppercase letter, one lowercase letter, one number, and one special character.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                      Role Selection
                    </label>
                    <SelectMenu
                      value={adminRole}
                      options={roleOptions}
                      onValueChange={(value) =>
                        setAdminRole(
                          value as "SUPER_ADMIN" | "ADMIN" | "OPERATOR" | "VIEWER"
                        )
                      }
                      label="Role"
                      side="top"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                      Account Status
                    </label>
                    <SelectMenu
                      value={adminActive ? "true" : "false"}
                      options={accountStatusOptions}
                      onValueChange={(value) => setAdminActive(value === "true")}
                      label="Account status"
                      side="top"
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
                  {formLoading ? "Creating..." : "Create Account"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editModalOpen && selectedAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg bg-white dark:bg-tail-dark-card rounded-lg shadow-xl border border-tail-border dark:border-tail-dark-border overflow-hidden animate-zoom-in">
            <div className="px-6 py-5 border-b border-tail-border dark:border-tail-dark-border flex justify-between items-center bg-slate-50 dark:bg-tail-dark-card">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Edit Admin Account
              </h3>
              <Button
                onClick={() => setEditModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <form onSubmit={handleEditAdmin}>
              <div className="p-6 space-y-4">
                {formError && (
                  <div className="rounded-lg bg-red-50 p-4 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-400 border border-red-100 dark:border-red-900/50">
                    {formError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    required
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    placeholder="Jane Doe"
                    className="block w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-hidden dark:border-tail-dark-border dark:bg-tail-dark-bg dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="jane@company.com"
                    className="block w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-hidden dark:border-tail-dark-border dark:bg-tail-dark-bg dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                    New Password (Optional)
                  </label>
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Leave blank to keep current password"
                    className="block w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-950 focus:border-indigo-500 focus:bg-white focus:outline-hidden dark:border-tail-dark-border dark:bg-tail-dark-bg dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                      Role Selection
                    </label>
                    <SelectMenu
                      value={adminRole}
                      options={roleOptions}
                      onValueChange={(value) =>
                        setAdminRole(
                          value as "SUPER_ADMIN" | "ADMIN" | "OPERATOR" | "VIEWER"
                        )
                      }
                      label="Role"
                      side="top"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                      Account Status
                    </label>
                    <SelectMenu
                      value={adminActive ? "true" : "false"}
                      options={accountStatusOptions}
                      onValueChange={(value) => setAdminActive(value === "true")}
                      label="Account status"
                      side="top"
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
      {deleteConfirmOpen && selectedAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white dark:bg-tail-dark-card rounded-lg shadow-xl border border-tail-border dark:border-tail-dark-border overflow-hidden animate-zoom-in">
            <div className="p-6">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Delete Admin Account?
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                Are you sure you want to permanently delete the admin account for{" "}
                <strong className="text-slate-800 dark:text-white">
                  {selectedAdmin.name} ({selectedAdmin.email})
                </strong>
                ? This action will block all future admin console access for this account.
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
                onClick={handleDeleteAdmin}
                disabled={formLoading}
                className="px-4 py-2.5 rounded-lg bg-red-600 text-white hover:bg-red-700 text-sm font-semibold shadow-md disabled:opacity-50 transition-colors cursor-pointer"
              >
                {formLoading ? "Deleting..." : "Delete Account"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
