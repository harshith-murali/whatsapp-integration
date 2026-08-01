import React from "react";
import { useAuth } from "../context/AuthContext.js";
import { MessageSquare, RefreshCw, Eye } from "lucide-react";

export const Messages: React.FC = () => {
  const { admin } = useAuth();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Message Delivery Logs
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Track individual delivery statuses, webhook delivery events, and failed logs.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-white/80 bg-white shadow-xs p-6 dark:border-tail-dark-border dark:bg-tail-dark-card">
        <div className="flex flex-col items-center justify-center text-center py-10 max-w-lg mx-auto space-y-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/50">
            <MessageSquare className="h-8 w-8" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">
            Message logs — Coming in Phase 2
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            Message status events tracking, WhatsApp message ID links, and retry actions for delivery failures will be introduced in the next phase.
          </p>

          <div className="w-full border-t border-slate-100 dark:border-slate-800 my-4 pt-4 text-left">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
              Your Role Permissions ({admin?.role.replace("_", " ")})
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="flex items-center space-x-2 text-slate-600 dark:text-slate-300">
                <Eye className="h-4 w-4 text-indigo-500 shrink-0" />
                <span>View delivery status logs (All roles)</span>
              </div>
              {admin && ["SUPER_ADMIN", "ADMIN"].includes(admin.role) && (
                <div className="flex items-center space-x-2 text-slate-600 dark:text-slate-300">
                  <RefreshCw className="h-4 w-4 text-indigo-500 shrink-0" />
                  <span>Retry failed messages</span>
                </div>
              )}
              {admin && !["SUPER_ADMIN", "ADMIN"].includes(admin.role) && (
                <div className="flex items-center space-x-2 text-slate-400 dark:text-slate-500 line-through">
                  <RefreshCw className="h-4 w-4 shrink-0" />
                  <span>Retry failed messages (Access Denied)</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
