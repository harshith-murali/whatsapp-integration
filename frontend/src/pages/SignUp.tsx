import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Mail, Phone, Send, UserRound } from "lucide-react";
import { AuthShell } from "../components/AuthShell.js";
import { Button } from "../components/ui/button.js";
import { SelectMenu } from "../components/ui/select-menu.js";
import { countryCodes } from "../utils/countryCodes.js";
import { api } from "../api/index.js";

export const SignUp: React.FC = () => {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [company, setCompany] = useState("");
  const [department, setDepartment] = useState("");
  const [reason, setReason] = useState("");
  const [requestedRole, setRequestedRole] = useState("");
  const [requestMessage, setRequestMessage] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formStartedAt] = useState(() => Date.now());

  const countryOptions = useMemo(
    () =>
      countryCodes.map((country) => ({
        value: country.code,
        label: `${country.iso} ${country.code}`,
      })),
    []
  );

  const roleOptions = [
    { value: "", label: "No preference" },
    { value: "ADMIN", label: "Admin" },
    { value: "OPERATOR", label: "Operator" },
    { value: "VIEWER", label: "Viewer" },
  ];

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setRequestMessage(null);

    if (!firstName.trim() || !lastName.trim() || !email.trim() || !phoneNumber.trim()) {
      setRequestMessage("Fill in your name, work email, country code, and phone number before submitting.");
      return;
    }

    setLoading(true);
    try {
      await api.post("/access-requests", {
        firstName,
        lastName,
        email,
        phoneNumber: `${countryCode}${phoneNumber}`,
        company: company || undefined,
        department: department || undefined,
        reason: reason || undefined,
        requestedRole: requestedRole || undefined,
        formStartedAt,
        website: "",
      });
      setSubmitted(true);
    } catch (error: any) {
      setRequestMessage(
        error.response?.data?.message || "We could not submit this access request. Please check the form and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow="ACCESS"
      title={submitted ? "Access request submitted" : "Request Platform Access"}
      subtitle={
        submitted
          ? "Your request has been sent to a Super Admin for review. You will be contacted if access is approved."
          : "Submit your details for review. A Super Admin will create your account if approved."
      }
    >
      {submitted ? (
        <div className="space-y-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600">
            No account or session was created. After approval, sign in with the credentials provided by your Super Admin.
          </div>
          <Link
            to="/login"
            className="inline-flex h-12 w-full items-center justify-center rounded-lg bg-black px-4 text-sm font-semibold text-white shadow-lg shadow-slate-950/10 transition-colors hover:bg-slate-900 focus:outline-hidden focus:ring-4 focus:ring-slate-300"
          >
            Return to Sign In
          </Link>
        </div>
      ) : (
        <>
      {requestMessage && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-medium leading-6 text-rose-700">
          <span>{requestMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-800">
              First name
            </label>
            <div className="relative">
              <UserRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                required
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                placeholder="First name"
                className="block h-12 w-full rounded-lg border border-transparent bg-slate-100 pl-11 pr-4 text-sm text-slate-950 shadow-inner outline-hidden transition focus:border-slate-300 focus:bg-white focus:ring-4 focus:ring-slate-200/80"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-800">
              Last name
            </label>
            <div className="relative">
              <UserRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                required
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                placeholder="Last name"
                className="block h-12 w-full rounded-lg border border-transparent bg-slate-100 pl-11 pr-4 text-sm text-slate-950 shadow-inner outline-hidden transition focus:border-slate-300 focus:bg-white focus:ring-4 focus:ring-slate-200/80"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-800">
            Work email
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Enter your email"
              className="block h-12 w-full rounded-lg border border-transparent bg-slate-100 pl-11 pr-4 text-sm text-slate-950 shadow-inner outline-hidden transition focus:border-slate-300 focus:bg-white focus:ring-4 focus:ring-slate-200/80"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-800">
              Company
            </label>
            <input
              type="text"
              value={company}
              onChange={(event) => setCompany(event.target.value)}
              placeholder="Optional"
              className="block h-12 w-full rounded-lg border border-transparent bg-slate-100 px-4 text-sm text-slate-950 shadow-inner outline-hidden transition focus:border-slate-300 focus:bg-white focus:ring-4 focus:ring-slate-200/80"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-800">
              Department
            </label>
            <input
              type="text"
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
              placeholder="Optional"
              className="block h-12 w-full rounded-lg border border-transparent bg-slate-100 px-4 text-sm text-slate-950 shadow-inner outline-hidden transition focus:border-slate-300 focus:bg-white focus:ring-4 focus:ring-slate-200/80"
            />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-800">
            Requested role
          </label>
          <SelectMenu
            value={requestedRole}
            onValueChange={setRequestedRole}
            options={roleOptions}
            label="Requested role"
            className="h-12 border-transparent bg-slate-100 text-slate-950 shadow-inner hover:bg-white"
          />
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Requested role is only a preference. Final access is assigned by a Super Admin.
          </p>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-800">
            Reason for access
          </label>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Optional"
            rows={3}
            className="block w-full resize-none rounded-lg border border-transparent bg-slate-100 px-4 py-3 text-sm text-slate-950 shadow-inner outline-hidden transition focus:border-slate-300 focus:bg-white focus:ring-4 focus:ring-slate-200/80"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-800">
            Phone number
          </label>
          <div className="grid grid-cols-[124px_1fr] gap-3">
            <SelectMenu
              value={countryCode}
              onValueChange={setCountryCode}
              options={countryOptions}
              label="Country code"
              className="h-12 border-transparent bg-slate-100 text-slate-950 shadow-inner hover:bg-white"
              contentClassName="w-56"
            />
            <div className="relative">
              <Phone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="tel"
                required
                value={phoneNumber}
                onChange={(event) => setPhoneNumber(event.target.value.replace(/[^\d\s-]/g, ""))}
                placeholder="Phone number"
                className="block h-12 w-full rounded-lg border border-transparent bg-slate-100 pl-11 pr-4 text-sm text-slate-950 shadow-inner outline-hidden transition focus:border-slate-300 focus:bg-white focus:ring-4 focus:ring-slate-200/80"
              />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
          This only submits an access request. It will not create an account, assign a role, or sign you in.
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="mt-6 flex h-12 w-full justify-center rounded-lg bg-black px-4 text-sm font-semibold text-white shadow-lg shadow-slate-950/10 hover:bg-slate-900 focus:ring-4 focus:ring-slate-300"
        >
          {loading ? (
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <>
              <Send className="h-4 w-4" />
              Send Access Request
            </>
          )}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link to="/login" className="font-semibold text-slate-950 hover:underline">
          Sign In
        </Link>
      </p>
        </>
      )}
    </AuthShell>
  );
};
