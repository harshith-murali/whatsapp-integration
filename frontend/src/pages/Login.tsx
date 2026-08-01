import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";
import { useTheme } from "../hooks/useTheme.js";
import { Eye, EyeOff, Lock, Mail, Moon, Sun } from "lucide-react";

interface RouteState {
  from?: {
    pathname?: string;
  };
}

const getErrorMessage = (error: unknown, fallback: string) => {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof error.response === "object" &&
    error.response !== null &&
    "data" in error.response &&
    typeof error.response.data === "object" &&
    error.response.data !== null &&
    "message" in error.response.data &&
    typeof error.response.data.message === "string"
  ) {
    return error.response.data.message;
  }

  return fallback;
};

export const Login: React.FC = () => {
  const { login } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const from = (location.state as RouteState | null)?.from?.pathname || "/";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please fill in all fields.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err: unknown) {
      setError(
        getErrorMessage(
          err,
          "Failed to sign in. Please verify your credentials."
        )
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-dvh items-center justify-center bg-slate-100 px-4 py-8 dark:bg-tail-dark-bg md:px-8">
      <button
        type="button"
        onClick={toggleTheme}
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-600 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50 dark:bg-tail-dark-card dark:text-slate-300 dark:ring-tail-dark-border dark:hover:bg-slate-800 md:right-8 md:top-8"
        title={isDark ? "Switch to light mode" : "Switch to dark mode"}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      >
        {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </button>

      {/* Main Layout Card */}
      <div className="flex min-h-[620px] w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-white/80 bg-white shadow-xl shadow-slate-200/70 dark:border-tail-dark-border/80 dark:bg-tail-dark-card dark:shadow-black/20 md:flex-row">
        
        {/* Left Side: Illustration & Branding Panel (TailAdmin Spec) */}
        <div className="flex w-full flex-col justify-between border-b border-tail-sidebar-active bg-tail-sidebar p-8 text-white md:w-[46%] md:border-b-0 md:border-r lg:p-12">
          <div>
            <div className="mb-8 flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 font-bold text-xl shadow-md shadow-indigo-600/35">
                W
              </div>
              <span className="text-2xl font-bold tracking-tight text-white">
                TailAdmin
              </span>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-tail-sidebar-text">
              Simplify your notification pipeline and manage bulk customer alerts in real-time.
            </p>
          </div>

          {/* Centralized Vector Illustration */}
          <div className="my-8 flex items-center justify-center">
            <svg
              width="280"
              height="280"
              viewBox="0 0 280 280"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="h-auto w-full max-w-[280px] drop-shadow-lg"
            >
              <rect x="20" y="50" width="240" height="180" rx="10" fill="#333A48" />
              <rect x="35" y="65" width="210" height="110" rx="6" fill="#1C2434" />
              <rect x="35" y="190" width="120" height="12" rx="3" fill="#8A99AD" />
              <circle cx="230" cy="196" r="10" fill="#aa3bff" />
              <path d="M226 196L229 199L235 193" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="60" cy="120" r="25" fill="#3B82F6" fillOpacity="0.2" />
              <circle cx="60" cy="120" r="15" fill="#3B82F6" />
              <circle cx="220" cy="100" r="30" fill="#10B981" fillOpacity="0.2" />
              <circle cx="220" cy="100" r="18" fill="#10B981" />
              <rect x="95" y="90" width="90" height="8" rx="4" fill="#333A48" />
              <rect x="95" y="105" width="60" height="8" rx="4" fill="#333A48" />
            </svg>
          </div>

          <div className="text-xs text-tail-sidebar-text">
            © 2026 TailAdmin. All rights reserved.
          </div>
        </div>

        {/* Right Side: Sign In Form (TailAdmin Spec) */}
        <div className="flex w-full items-center justify-center bg-white p-8 dark:bg-tail-dark-card md:w-[54%] lg:p-12 xl:p-16">
          <div className="w-full max-w-md">
          <div className="mb-8 text-left">
            <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-2">
              Welcome back
            </span>
            <h2 className="text-2xl lg:text-3xl font-extrabold text-slate-900 dark:text-white">
              Sign In to TailAdmin
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
              Access your dashboard and manage WhatsApp subscribers.
            </p>
          </div>

          {error && (
            <div className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/20 dark:text-red-400 border border-red-100 dark:border-red-900/50">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                Email Address
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                  <Mail className="h-5 w-5" />
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="block w-full rounded-lg border border-slate-200 bg-white py-3 pl-12 pr-4 text-sm text-slate-900 placeholder-slate-400 transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-hidden dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                  <Lock className="h-5 w-5" />
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="block w-full rounded-lg border border-slate-200 bg-white py-3 pl-12 pr-12 text-sm text-slate-900 placeholder-slate-400 transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-hidden dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 hover:text-slate-600 dark:hover:text-white focus:outline-hidden cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="flex w-full justify-center rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-indigo-600/20 transition-colors hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500/20 focus:outline-hidden disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                ) : (
                  "Sign In"
                )}
              </button>
            </div>
          </form>

          {/* Prompt regarding Sign Up */}
          <div className="mt-8 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Don't have an account?{" "}
              <span className="text-indigo-600 dark:text-indigo-400 font-semibold select-none cursor-not-allowed">
                Contact Super Admin
              </span>
            </p>
          </div>
          </div>
        </div>

      </div>
    </div>
  );
};
