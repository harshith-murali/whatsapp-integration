import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Clipboard, Mail, Phone, UserRound } from "lucide-react";
import { AuthShell } from "../components/AuthShell.js";
import { Button } from "../components/ui/button.js";
import { SelectMenu } from "../components/ui/select-menu.js";
import { countryCodes } from "../utils/countryCodes.js";

export const SignUp: React.FC = () => {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [requestMessage, setRequestMessage] = useState<string | null>(null);

  const countryOptions = useMemo(
    () =>
      countryCodes.map((country) => ({
        value: country.code,
        label: `${country.iso} ${country.code}`,
      })),
    []
  );

  const requestDetails = [
    `First name: ${firstName.trim()}`,
    `Last name: ${lastName.trim()}`,
    `Email: ${email.trim()}`,
    `Phone: ${countryCode}${phoneNumber.replace(/\D/g, "")}`,
  ].join("\n");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!firstName.trim() || !lastName.trim() || !email.trim() || !phoneNumber.trim()) {
      setRequestMessage("Fill in your name, email, country code, and phone number before sending this to a Super Admin.");
      return;
    }

    try {
      await navigator.clipboard.writeText(requestDetails);
      setRequestMessage("Access details copied. Send them to your Super Admin so they can create your account.");
    } catch {
      setRequestMessage("Access details are ready. Send them to your Super Admin so they can create your account.");
    }
  };

  return (
    <AuthShell
      eyebrow="ACCESS"
      title="Create Access"
      subtitle="Share these details with a Super Admin so they can create your dashboard account."
    >
      {requestMessage && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium leading-6 text-slate-700">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
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
            Email
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
          Accounts are still created by a Super Admin. This form prepares the exact details they need, including your full phone number with country code.
        </div>

        <Button
          type="submit"
          className="mt-6 flex h-12 w-full justify-center rounded-lg bg-black px-4 text-sm font-semibold text-white shadow-lg shadow-slate-950/10 hover:bg-slate-900 focus:ring-4 focus:ring-slate-300"
        >
          <Clipboard className="h-4 w-4" />
          Prepare Access Details
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link to="/login" className="font-semibold text-slate-950 hover:underline">
          Sign In
        </Link>
      </p>
    </AuthShell>
  );
};
