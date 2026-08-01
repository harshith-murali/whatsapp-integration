import React, { useEffect, useState, useRef } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";
import { useTheme } from "../hooks/useTheme.js";
import { hasPermission } from "../utils/permissions.js";
import type { Permission } from "../utils/permissions.js";
import { AnimatedBackground } from "./core/animated-background.js";
import { Button } from "./ui/button.js";
import { api } from "../api/index.js";
import {
  LayoutDashboard,
  Users,
  FolderOpen,
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
  AlertCircle,
  CheckCircle2,
  Inbox,
  User,
  ClipboardList,
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

const PAGE_META: Record<string, { title: string; subtitle: string }> = {
  "/": {
    title: "Dashboard",
    subtitle: "Live overview of subscribers, broadcasts, and delivery progress.",
  },
  "/subscribers": {
    title: "Subscribers",
    subtitle: "Manage WhatsApp contacts, consent state, and subscriber records.",
  },
  "/groups": {
    title: "Groups",
    subtitle: "Organize subscribers into targeted broadcast audiences.",
  },
  "/broadcasts": {
    title: "Broadcasts",
    subtitle: "Create, approve, queue, and monitor WhatsApp broadcasts.",
  },
  "/messages": {
    title: "Messages",
    subtitle: "Review provider status, failures, retries, and delivery logs.",
  },
  "/admins": {
    title: "Admin Management",
    subtitle: "Manage admin accounts, roles, and access.",
  },
  "/access-requests": {
    title: "Access Requests",
    subtitle: "Review platform access requests and create approved admin accounts.",
  },
  "/settings": {
    title: "System Settings",
    subtitle: "Review integration status and operational configuration.",
  },
};

interface MenuItem {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  permission: Permission;
  badge?: number;
}

interface AdminNotification {
  id: number;
  type: string;
  title: string;
  message: string;
  link?: string | null;
  isRead: boolean;
  createdAt: string;
}

export const Layout: React.FC = () => {
  const { admin, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<"notifications" | "chat" | "profile" | null>(null);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [pendingAccessRequests, setPendingAccessRequests] = useState(0);
  const { isDark, toggleTheme } = useTheme();
  const notificationsRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (openMenu === "notifications" && notificationsRef.current && !notificationsRef.current.contains(target)) {
        setOpenMenu(null);
      }
      if (openMenu === "chat" && messagesRef.current && !messagesRef.current.contains(target)) {
        setOpenMenu(null);
      }
      if (openMenu === "profile" && profileRef.current && !profileRef.current.contains(target)) {
        setOpenMenu(null);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [openMenu]);
  const currentMeta =
    PAGE_META[location.pathname] ||
    (location.pathname.startsWith("/broadcasts/")
      ? {
          title: "Broadcast Details",
          subtitle: "Inspect recipients, message progress, and delivery state.",
        }
      : location.pathname.startsWith("/access-requests/")
        ? {
            title: "Access Request Details",
            subtitle: "Review requester details, audit history, and account approval state.",
          }
      : {
          title: "Workspace",
          subtitle: "Manage your WhatsApp alert operations.",
        });

  const closeMenus = () => setOpenMenu(null);

  const fetchHeaderData = async () => {
    if (!admin) return;
    try {
      const notificationResponse = await api.get("/notifications");
      setNotifications(notificationResponse.data.data.notifications || []);
      setUnreadNotifications(notificationResponse.data.data.unreadCount || 0);
    } catch {
      setNotifications([]);
      setUnreadNotifications(0);
    }

    if (hasPermission(admin.role, "accessRequests.view")) {
      try {
        const requestResponse = await api.get("/access-requests", {
          params: { status: "PENDING", limit: 1 },
        });
        setPendingAccessRequests(requestResponse.data.data.pendingCount || 0);
      } catch {
        setPendingAccessRequests(0);
      }
    }
  };

  useEffect(() => {
    fetchHeaderData();
  }, [admin?.id, location.pathname]);

  const goTo = (path: string) => {
    closeMenus();
    navigate(path);
  };

  const openNotification = async (notification: AdminNotification) => {
    if (!notification.isRead) {
      try {
        await api.patch(`/notifications/${notification.id}/read`);
      } catch {
        // Keep navigation responsive even if marking read fails.
      }
    }
    await fetchHeaderData();
    goTo(notification.link || "/access-requests");
  };

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
      name: "Groups",
      path: "/groups",
      icon: FolderOpen,
      permission: "groups.view",
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
      name: "Access Requests",
      path: "/access-requests",
      icon: ClipboardList,
      permission: "accessRequests.view",
      badge: pendingAccessRequests,
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
              <AnimatedBackground
                defaultValue={filteredItems.find((item) => item.path === location.pathname || (item.path !== "/" && location.pathname.startsWith(`${item.path}/`)))?.name}
                className="rounded-lg bg-tail-sidebar-active/70"
                enableHover
              >
                {filteredItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path || (item.path !== "/" && location.pathname.startsWith(`${item.path}/`));
                  return (
                    <Link
                      key={item.name}
                      data-id={item.name}
                      to={item.path}
                      className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors duration-200 ${
                        isActive
                          ? "bg-tail-sidebar-active text-white"
                          : "text-tail-sidebar-text hover:text-white"
                      }`}
                    >
                      <Icon className="h-5 w-5 mr-3 shrink-0" />
                      <span className="min-w-0 flex-1">{item.name}</span>
                      {!!item.badge && (
                        <span className="ml-2 rounded-full bg-indigo-500 px-2 py-0.5 text-[11px] font-bold text-white">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </AnimatedBackground>
            </nav>
          </div>
        </div>

        {/* Logout area */}
        <div className="p-4 border-t border-tail-sidebar-active">
          <button
            onClick={handleLogout}
            className="flex w-full items-center px-4 py-3 text-sm font-medium text-red-400 hover:bg-red-950/20 rounded-lg transition-colors cursor-pointer"
          >
            <LogOut className="h-5 w-5 mr-3 shrink-0" />
            <span>Sign Out</span>
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
              <Button
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg p-1.5 text-tail-sidebar-text hover:text-white hover:bg-tail-sidebar-active"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <nav className="flex-1 space-y-1 px-4 py-6 overflow-y-auto">
              <span className="block text-xs font-semibold text-tail-sidebar-text uppercase tracking-widest px-4 mb-3">
                Menu
              </span>
              <AnimatedBackground
                defaultValue={filteredItems.find((item) => item.path === location.pathname || (item.path !== "/" && location.pathname.startsWith(`${item.path}/`)))?.name}
                className="rounded-lg bg-tail-sidebar-active/70"
                enableHover
              >
                {filteredItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path || (item.path !== "/" && location.pathname.startsWith(`${item.path}/`));
                  return (
                    <Link
                      key={item.name}
                      data-id={item.name}
                      to={item.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors duration-200 ${
                        isActive
                          ? "bg-tail-sidebar-active text-white"
                          : "text-tail-sidebar-text hover:text-white"
                      }`}
                    >
                      <Icon className="h-5 w-5 mr-3 shrink-0" />
                      <span className="min-w-0 flex-1">{item.name}</span>
                      {!!item.badge && (
                        <span className="ml-2 rounded-full bg-indigo-500 px-2 py-0.5 text-[11px] font-bold text-white">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </AnimatedBackground>
            </nav>
            <div className="p-4 border-t border-tail-sidebar-active">
              <button
                onClick={handleLogout}
                className="flex w-full items-center px-4 py-3 text-sm font-medium text-red-400 hover:bg-red-950/20 rounded-lg cursor-pointer"
              >
                <LogOut className="h-5 w-5 mr-3 shrink-0" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Pane */}
      <div className="flex flex-1 flex-col overflow-hidden w-full">
        {/* Header */}
        <header className="flex h-20 items-center justify-between gap-4 px-6 lg:px-8 bg-white dark:bg-tail-dark-card border-b border-tail-border dark:border-tail-dark-border shrink-0">
          <div className="flex min-w-0 flex-1 items-center">
            <Button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 rounded-lg mr-4"
            >
              <Menu className="h-6 w-6" />
            </Button>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold leading-tight text-slate-950 dark:text-white">
                {currentMeta.title}
              </h1>
              <p className="mt-1 hidden max-w-2xl truncate text-sm text-slate-500 dark:text-slate-400 lg:block">
                {currentMeta.subtitle}
              </p>
            </div>
          </div>

          {/* Right Header widgets */}
          <div className="relative flex items-center space-x-4 lg:space-x-5">
            {/* Theme Toggle button */}
            <Button
              onClick={toggleTheme}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 cursor-pointer"
              title={isDark ? "Switch to light mode" : "Switch to dark mode"}
              aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            >
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>

            {/* Notification Bell */}
            <div ref={notificationsRef} className="relative">
              <Button
              onClick={() => {
                if (openMenu !== "notifications") {
                  fetchHeaderData();
                }
                setOpenMenu(openMenu === "notifications" ? null : "notifications");
              }}
              className="relative flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              title="Notifications"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              {unreadNotifications > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-500 px-1 text-[10px] font-bold text-white ring-2 ring-white dark:ring-tail-dark-card">
                  {unreadNotifications > 9 ? "9+" : unreadNotifications}
                </span>
              )}
              </Button>
              {openMenu === "notifications" && (
                <div className="absolute right-0 top-12 z-40 w-80 overflow-hidden rounded-lg border border-tail-border bg-white shadow-xl shadow-slate-200/70 dark:border-tail-dark-border dark:bg-tail-dark-card dark:shadow-black/20">
                  <div className="border-b border-tail-border px-4 py-3 dark:border-tail-dark-border">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      Notifications
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {unreadNotifications} unread updates.
                    </p>
                  </div>
                  <div className="p-2">
                    {notifications.length === 0 ? (
                      <div className="px-3 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                        No notifications yet.
                      </div>
                    ) : (
                      notifications.map((notification) => (
                        <button
                          key={notification.id}
                          onClick={() => openNotification(notification)}
                          className="flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          {notification.isRead ? (
                            <CheckCircle2 className="mt-0.5 h-4 w-4 text-slate-400" />
                          ) : (
                            <AlertCircle className="mt-0.5 h-4 w-4 text-indigo-500" />
                          )}
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                              {notification.title}
                            </span>
                            <span className="mt-0.5 block line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                              {notification.message}
                            </span>
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Messages icon */}
            <div ref={messagesRef} className="relative">
              <Button
              onClick={() => setOpenMenu(openMenu === "chat" ? null : "chat")}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              title="Messages"
              aria-label="Messages"
            >
              <MessageSquare className="h-5 w-5" />
              </Button>
              {openMenu === "chat" && (
                <div className="absolute right-0 top-12 z-40 w-72 overflow-hidden rounded-lg border border-tail-border bg-white shadow-xl shadow-slate-200/70 dark:border-tail-dark-border dark:bg-tail-dark-card dark:shadow-black/20">
                  <div className="border-b border-tail-border px-4 py-3 dark:border-tail-dark-border">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      Message Center
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      Jump into messaging workflows.
                    </p>
                  </div>
                  <div className="p-2 space-y-0.5">
                    <button
                      onClick={() => goTo("/messages")}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                    >
                      <span className="flex h-7 w-7 items-center justify-center shrink-0">
                        <MessageSquare className="h-4 w-4 text-indigo-500" />
                      </span>
                      <span className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                        Open message logs
                      </span>
                    </button>
                    <button
                      onClick={() => goTo("/subscribers?add=true")}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                    >
                      <span className="flex h-7 w-7 items-center justify-center shrink-0">
                        <Inbox className="h-4 w-4 text-emerald-500" />
                      </span>
                      <span className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                        Add subscriber
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* User Profile */}
            <div ref={profileRef} className="relative flex items-center space-x-3 pl-4 border-l border-slate-200 dark:border-slate-800">
              <div className="text-right hidden lg:block">
                <p className="text-sm font-semibold text-slate-900 dark:text-white leading-tight">
                  {admin?.name}
                </p>
                <p className="text-[11px] text-slate-400 font-medium tracking-wide">
                  {admin ? ROLE_LABELS[admin.role] : ""}
                </p>
              </div>
              <Button
                onClick={() => setOpenMenu(openMenu === "profile" ? null : "profile")}
                className="flex items-center space-x-1.5 cursor-pointer group"
                aria-label="Profile menu"
              >
                <div className="h-10 w-10 rounded-full bg-indigo-500 text-white flex items-center justify-center font-bold text-sm shadow-inner uppercase">
                  {admin?.name.substring(0, 2)}
                </div>
                <ChevronDown className="h-4 w-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-white" />
              </Button>
              {openMenu === "profile" && (
                <div className="absolute right-0 top-14 z-40 w-72 overflow-hidden rounded-lg border border-tail-border bg-white shadow-xl shadow-slate-200/70 dark:border-tail-dark-border dark:bg-tail-dark-card dark:shadow-black/20">
                  <div className="border-b border-tail-border px-4 py-4 dark:border-tail-dark-border">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      {admin?.name}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {admin?.email}
                    </p>
                    <span className="mt-2 inline-flex rounded-md bg-indigo-50 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-300">
                      {admin ? ROLE_LABELS[admin.role] : ""}
                    </span>
                  </div>
                  <div className="p-2 space-y-0.5">
                    <button
                      onClick={() => goTo("/settings")}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 shrink-0">
                        <SettingsIcon className="h-4 w-4" />
                      </span>
                      <span className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                        Settings
                      </span>
                    </button>
                    <button
                      onClick={() => goTo("/admins")}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 shrink-0">
                        <User className="h-4 w-4" />
                      </span>
                      <span className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                        Admin management
                      </span>
                    </button>
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-red-650 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/20 transition-colors cursor-pointer"
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg text-red-500 dark:text-red-400 shrink-0">
                        <LogOut className="h-4 w-4" />
                      </span>
                      <span className="truncate text-sm font-semibold">Sign out</span>
                    </button>
                  </div>
                </div>
              )}
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
