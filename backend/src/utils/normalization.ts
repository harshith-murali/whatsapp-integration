export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

export const normalizePhoneNumber = (phoneNumber: string): string => {
  const digits = phoneNumber.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) {
    return "";
  }
  return digits;
};

export const maskEmail = (email: string): string => {
  const normalized = normalizeEmail(email);
  const [local = "", domain = ""] = normalized.split("@");
  if (!local || !domain) return "[invalid-email]";
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"*".repeat(Math.max(2, local.length - visible.length))}@${domain}`;
};

export const sanitizeText = (value: string | undefined | null, maxLength: number): string | undefined => {
  const trimmed = value?.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLength);
};
