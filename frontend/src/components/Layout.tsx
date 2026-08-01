import React, { useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";
import { useTheme } from "../hooks/useTheme.js";
import { hasPermission } from "../utils/permissions.js";
import type { Permission } from "../utils/permissions.js";
import {
  LayoutDashboard,
  Users,
  UserCheck,
  Settings as SettingsIcon,
  LogOut,
  Menu,
  X,
  Bell,
  MessageSquare,
  Sun,
  Moon,
  ChevronDown,
} from "lucide-react";

// Custom Megaphone/Broadcast icon
const MegaphoneIcon = ({ className }: { className?: string }) => (
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
    <path d="m3 11 18-5v12L3 13v-2Z" />
    <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
  </svg>
);

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  OPERATOR: "Operator",
  VIEWER: "Viewer",
};

interface MenuItem {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  permission: Permission;
}

export const Layout: React.FC = () => {
  const { admin, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isDark, toggleTheme } = useTheme();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const menuItems: MenuItem[] = [
    {
      name: "Dashboard",
      path: "/",
      icon: LayoutDashboard,
      permission: "dashboard.view",
    },
    {
      name: "Subscribers",
      path: "/subscribers",
      icon: Users,
      permission: "subscribers.view",
    },
    {
      name: "Broadcasts",
      path: "/broadcasts",
      icon: MegaphoneIcon,
      permission: "broadcasts.view",
    },
    {
      name: "Messages",
      path: "/messages",
      icon: MessageSquare,
      permission: "messages.view",
    },
    {
      name: "Admins",
      path: "/admins",
      icon: UserCheck,
      permission: "admins.view",
    },
    {
      name: "Settings",
      path: "/settings",
      icon: SettingsIcon,
      permission: "settings.manage",
    },
  ];

  const filteredItems = menuItems.filter(
    (item) => admin && hasPermission(admin.role, item.permission)
  );

  return (
    <div className="flex h-screen w-full bg-tail-bg dark:bg-tail-dark-bg font-sans text-slate-800 dark:text-slate-100 overflow-hidden">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex md:w-64 md:flex-col bg-tail-sidebar shrink-0">
        {/* Brand Area */}
        <div className="flex h-20 items-center px-6 border-b border-tail-sidebar-active">
          <div className="flex items-center space-x-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold text-lg shadow-md shadow-indigo-600/35">
              W
            </div>
            <span className="text-xl font-bold tracking-tight text-white">
              TailAdmin
            </span>
          </div>
        </div>

        {/* Sidebar Nav */}
        <div className="flex-grow overflow-y-auto px-4 py-6">
          <div className="mb-4">
            <span className="block text-xs font-semibold text-tail-sidebar-text uppercase tracking-widest px-4 mb-3">
              Menu
            </span>
            <nav className="space-y-1">
              {filteredItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.name}
                    to={item.path}
                    className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-all duration-150 ${
                      isActive
                        ? "bg-tail-sidebar-active text-white"
                        : "text-tail-sidebar-text hover:text-white hover:bg-tail-sidebar-active/60"
                    }`}
                  >
                    <Icon className="h-5 w-5 mr-3 shrink-0" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Logout area */}
        <div className="p-4 border-t border-tail-sidebar-active">
          <button
            onClick={handleLogout}
            className="flex w-full items-center px-4 py-3 text-sm font-medium text-red-400 hover:bg-red-950/20 rounded-lg transition-colors cursor-pointer animate-none"
          >
            <LogOut className="h-5 w-5 mr-3 shrink-0" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Menu Panel */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden bg-slate-900/60 backdrop-blur-xs">
          <div className="relative flex w-full max-w-xs flex-col bg-tail-sidebar shadow-2xl animate-slide-in">
            <div className="flex h-20 items-center justify-between px-6 border-b border-tail-sidebar-active">
              <div className="flex items-center space-x-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold text-lg">
                  W
                </div>
                <span className="text-xl font-bold tracking-tight text-white">
                  TailAdmin
                </span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg p-1.5 text-tail-sidebar-text hover:text-white hover:bg-tail-sidebar-active"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 space-y-1 px-4 py-6 overflow-y-auto">
              <span className="block text-xs font-semibold text-tail-sidebar-text uppercase tracking-widest px-4 mb-3">
                Menu
              </span>
              {filteredItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.name}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg ${
                      isActive
                        ? "bg-tail-sidebar-active text-white"
                        : "text-tail-sidebar-text hover:text-white hover:bg-tail-sidebar-active/60"
                    }`}
                  >
                    <Icon className="h-5 w-5 mr-3 shrink-0" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
            <div className="p-4 border-t border-tail-sidebar-active">
              <button
                onClick={handleLogout}
                className="flex w-full items-center px-4 py-3 text-sm font-medium text-red-400 hover:bg-red-950/20 rounded-lg"
              >
                <LogOut className="h-5 w-5 mr-3" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Pane */}
      <div className="flex flex-1 flex-col overflow-hidden w-full">
        {/* Header */}
        <header className="flex h-20 items-center justify-between px-6 lg:px-8 bg-white dark:bg-tail-dark-card border-b border-tail-border dark:border-tail-dark-border shrink-0">
          <div className="flex items-center flex-1">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 rounded-lg mr-4"
            >
              <Menu className="h-6 w-6" />
            </button>
          </div>

          {/* Right Header widgets */}
          <div className="flex items-center space-x-6">
            {/* Theme Toggle button */}
            <button
              onClick={toggleTheme}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 cursor-pointer"
              title={isDark ? "Switch to light mode" : "Switch to dark mode"}
              aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            >
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>

            {/* Notification Bell (no badge — not yet implemented) */}
            <button
              className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              title="Notifications module is planned for a later phase"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
            </button>

            {/* Messages icon (no badge — not yet implemented) */}
            <button
              className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              title="Messages chat module is planned for a later phase"
              aria-label="Messages"
            >
              <MessageSquare className="h-5 w-5" />
            </button>

            {/* User Profile */}
            <div className="flex items-center space-x-3 pl-4 border-l border-slate-200 dark:border-slate-800">
              <div className="text-right hidden lg:block">
                <p className="text-sm font-semibold text-slate-900 dark:text-white leading-tight">
                  {admin?.name}
                </p>
                <p className="text-[11px] text-slate-400 font-medium tracking-wide">
                  {admin ? ROLE_LABELS[admin.role] : ""}
                </p>
              </div>
              <div className="flex items-center space-x-1.5 cursor-pointer group">
                <div className="h-10 w-10 rounded-full bg-indigo-500 text-white flex items-center justify-center font-bold text-sm shadow-inner uppercase">
                  {admin?.name.substring(0, 2)}
                </div>
                <ChevronDown className="h-4 w-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-white" />
              </div>
            </div>
          </div>
        </header>

        {/* Content Pane */}
        <main className="flex-1 overflow-y-auto bg-tail-bg dark:bg-tail-dark-bg p-6 lg:p-8 w-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
