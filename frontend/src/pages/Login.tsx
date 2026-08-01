import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff, Lock, Mail, RotateCcw } from "lucide-react";
import { AuthShell } from "../components/AuthShell.js";
import { Button } from "../components/ui/button.js";
import { useAuth } from "../context/AuthContext.js";

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
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);
  const [mode, setMode] = useState<"login" | "reset">("login");

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
      setError(getErrorMessage(err, "Failed to sign in. Please verify your credentials."));
    } finally {
      setLoading(false);
    }
  };

  const handleResetRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError("Enter your account email to request a password reset.");
      return;
    }

    setError(null);
    setRecoveryMessage(
      "Password resets are handled by a Super Admin. Share this email with them so they can update your password from Admin Management."
    );
  };

  const isResetMode = mode === "reset";

  return (
    <AuthShell
      eyebrow={isResetMode ? "RECOVERY" : "OPERATIONS"}
      title={isResetMode ? "Reset Password" : "Welcome Back"}
      subtitle={
        isResetMode
          ? "Enter your account email and request a Super Admin password reset."
          : "Enter your credentials to access the WhatsApp alert console."
      }
    >
      {error && (
        <div className="mb-6 rounded-lg border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      )}

      {recoveryMessage && (
        <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
          {recoveryMessage}
        </div>
      )}

      <form onSubmit={isResetMode ? handleResetRequest : handleSubmit} className="space-y-5">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-800">
            Email
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="block h-12 w-full rounded-lg border border-transparent bg-slate-100 pl-11 pr-4 text-sm text-slate-950 shadow-inner outline-hidden transition focus:border-slate-300 focus:bg-white focus:ring-4 focus:ring-slate-200/80"
            />
          </div>
        </div>

        {!isResetMode && (
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-800">
              Password
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="block h-12 w-full rounded-lg border border-transparent bg-slate-100 pl-11 pr-12 text-sm text-slate-950 shadow-inner outline-hidden transition focus:border-slate-300 focus:bg-white focus:ring-4 focus:ring-slate-200/80"
              />
              <Button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center px-4 text-slate-400 hover:text-slate-700"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <div className="mt-3 flex justify-end">
              <Button
                type="button"
                onClick={() => {
                  setMode("reset");
                  setError(null);
                  setRecoveryMessage(null);
                }}
                className="text-sm font-semibold text-slate-950 hover:text-slate-600"
              >
                Forgot password?
              </Button>
            </div>
          </div>
        )}

        {isResetMode && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
            Super Admins can reset passwords from the Admin Management page. This keeps account recovery controlled for broadcast permissions.
          </div>
        )}

        <div className={isResetMode ? "grid grid-cols-[auto_1fr] gap-3 pt-3" : ""}>
          {isResetMode && (
            <Button
              type="button"
              onClick={() => {
                setMode("login");
                setError(null);
                setRecoveryMessage(null);
              }}
              className="h-12 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          )}

          <Button
            type="submit"
            disabled={loading}
            className={`${isResetMode ? "" : "mt-8"} flex h-12 w-full justify-center rounded-lg bg-black px-4 text-sm font-semibold text-white shadow-lg shadow-slate-950/10 hover:bg-slate-900 focus:ring-4 focus:ring-slate-300 disabled:opacity-60`}
          >
            {loading ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : isResetMode ? (
              <>
                <RotateCcw className="h-4 w-4" />
                Request Reset
              </>
            ) : (
              "Sign In"
            )}
          </Button>
        </div>
      </form>

      <p className="mt-12 text-center text-sm text-slate-500">
        Don&apos;t have an account?{" "}
        <Link to="/signup" className="font-semibold text-slate-950 hover:underline">
          Sign Up
        </Link>
      </p>
    </AuthShell>
  );
};
