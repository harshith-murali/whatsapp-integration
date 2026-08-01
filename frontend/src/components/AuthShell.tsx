import React from "react";
import { MessageSquareText } from "lucide-react";

interface AuthShellProps {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

export const AuthShell: React.FC<AuthShellProps> = ({ eyebrow, title, subtitle, children }) => {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-white px-4 py-8 md:px-8">
      <div className="absolute inset-0 auth-page-glow" />
      <div className="relative grid min-h-[720px] w-full max-w-7xl overflow-hidden rounded-[26px] bg-black p-3 shadow-2xl shadow-slate-950/20 md:grid-cols-[1.05fr_1fr]">
        <section className="auth-ribbon-panel relative hidden overflow-hidden rounded-[22px] border-[6px] border-white md:flex md:flex-col md:justify-between">
          <div className="relative z-10 p-10 lg:p-14">
            <div className="flex items-center gap-4">
              <span className="text-xs font-bold uppercase tracking-[0.32em] text-white/80">
                {eyebrow}
              </span>
              <span className="h-px w-36 bg-white/45" />
            </div>
          </div>

          <div className="relative z-10 p-10 lg:p-14">
            <h1 className="max-w-md text-5xl font-semibold leading-[0.95] tracking-normal text-white lg:text-6xl">
              Secure WhatsApp broadcast control
            </h1>
            <p className="mt-6 max-w-md text-sm leading-7 text-white/75">
              Manage contacts, approvals, templates, and delivery logs from one operational console.
            </p>
          </div>
        </section>

        <section className="flex min-h-[680px] flex-col rounded-[22px] bg-white px-6 py-8 sm:px-10 lg:px-16">
          <div className="flex items-center justify-center gap-2 text-slate-950">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-950 text-white">
              <MessageSquareText className="h-4 w-4" />
            </span>
            <span className="text-lg font-semibold">TailAdmin</span>
          </div>

          <div className="flex flex-1 items-center justify-center">
            <div className="w-full max-w-md animate-auth-rise">
              <div className="mb-9 text-center">
                <h2 className="text-4xl font-semibold tracking-normal text-slate-950 md:text-5xl">
                  {title}
                </h2>
                <p className="mt-4 text-sm leading-6 text-slate-500">
                  {subtitle}
                </p>
              </div>
              {children}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
