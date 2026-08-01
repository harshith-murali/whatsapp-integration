import React from "react";
import { Settings as SettingsIcon, ShieldCheck } from "lucide-react";

export const Settings: React.FC = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            System Settings
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage system settings, global configurations, and integration credentials.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-white/80 bg-white shadow-xs p-6 dark:border-tail-dark-border dark:bg-tail-dark-card">
        <div className="flex flex-col items-center justify-center text-center py-10 max-w-lg mx-auto space-y-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/50">
            <SettingsIcon className="h-8 w-8" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">
            System Configuration — Coming in Phase 2
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            WhatsApp Business profile setups, custom webhooks, rate limits, and webhook verification settings will be configurable in Phase 2.
          </p>

          <div className="flex items-center space-x-2 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/15 p-3 text-xs text-indigo-700 dark:text-indigo-400 border border-indigo-100/50 dark:border-indigo-900/40">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            <span>Only SUPER ADMIN accounts are authorized to manage these configurations.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
