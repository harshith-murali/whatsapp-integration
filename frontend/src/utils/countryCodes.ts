export type CountryCodeOption = {
  name: string;
  code: string;
  iso: string;
};

export const countryCodes: CountryCodeOption[] = [
  { name: "Afghanistan", code: "+93", iso: "AF" },
  { name: "Albania", code: "+355", iso: "AL" },
  { name: "Algeria", code: "+213", iso: "DZ" },
  { name: "Argentina", code: "+54", iso: "AR" },
  { name: "Australia", code: "+61", iso: "AU" },
  { name: "Austria", code: "+43", iso: "AT" },
  { name: "Bangladesh", code: "+880", iso: "BD" },
  { name: "Belgium", code: "+32", iso: "BE" },
  { name: "Brazil", code: "+55", iso: "BR" },
  { name: "Canada", code: "+1", iso: "CA" },
  { name: "China", code: "+86", iso: "CN" },
  { name: "Denmark", code: "+45", iso: "DK" },
  { name: "Egypt", code: "+20", iso: "EG" },
  { name: "France", code: "+33", iso: "FR" },
  { name: "Germany", code: "+49", iso: "DE" },
  { name: "Hong Kong", code: "+852", iso: "HK" },
  { name: "India", code: "+91", iso: "IN" },
  { name: "Indonesia", code: "+62", iso: "ID" },
  { name: "Ireland", code: "+353", iso: "IE" },
  { name: "Italy", code: "+39", iso: "IT" },
  { name: "Japan", code: "+81", iso: "JP" },
  { name: "Kenya", code: "+254", iso: "KE" },
  { name: "Malaysia", code: "+60", iso: "MY" },
  { name: "Mexico", code: "+52", iso: "MX" },
  { name: "Nepal", code: "+977", iso: "NP" },
  { name: "Netherlands", code: "+31", iso: "NL" },
  { name: "New Zealand", code: "+64", iso: "NZ" },
  { name: "Nigeria", code: "+234", iso: "NG" },
  { name: "Pakistan", code: "+92", iso: "PK" },
  { name: "Philippines", code: "+63", iso: "PH" },
  { name: "Qatar", code: "+974", iso: "QA" },
  { name: "Russia", code: "+7", iso: "RU" },
  { name: "Saudi Arabia", code: "+966", iso: "SA" },
  { name: "Singapore", code: "+65", iso: "SG" },
  { name: "South Africa", code: "+27", iso: "ZA" },
  { name: "South Korea", code: "+82", iso: "KR" },
  { name: "Spain", code: "+34", iso: "ES" },
  { name: "Sri Lanka", code: "+94", iso: "LK" },
  { name: "Sweden", code: "+46", iso: "SE" },
  { name: "Switzerland", code: "+41", iso: "CH" },
  { name: "Thailand", code: "+66", iso: "TH" },
  { name: "Turkey", code: "+90", iso: "TR" },
  { name: "United Arab Emirates", code: "+971", iso: "AE" },
  { name: "United Kingdom", code: "+44", iso: "GB" },
  { name: "United States", code: "+1", iso: "US" },
  { name: "Vietnam", code: "+84", iso: "VN" },
];

export const splitPhoneNumber = (phoneNumber: string, fallbackCode = "+91") => {
  const digits = phoneNumber.replace(/\D/g, "");
  const sortedCodes = [...countryCodes].sort(
    (a, b) => b.code.replace("+", "").length - a.code.replace("+", "").length
  );
  const match = sortedCodes.find((country) =>
    digits.startsWith(country.code.replace("+", ""))
  );

  if (!match) {
    return { countryCode: fallbackCode, nationalNumber: digits };
  }

  return {
    countryCode: match.code,
    nationalNumber: digits.slice(match.code.replace("+", "").length),
  };
};
