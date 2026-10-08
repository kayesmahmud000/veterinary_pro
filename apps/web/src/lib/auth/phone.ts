import {
  getCountries,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js/max";

export const DEFAULT_PHONE_COUNTRY: CountryCode = "BD";
export const phoneCountries = getCountries();
type PhoneResult = { phone?: string; error?: "phone" };

export function normalizePhoneDigits(value: string) {
  return value.replace(/[০-৯٠-٩۰-۹]/g, (digit) => {
    const code = digit.charCodeAt(0);
    return String(
      code >= 0x09e6
        ? code - 0x09e6
        : code >= 0x06f0
          ? code - 0x06f0
          : code - 0x0660,
    );
  });
}

function phoneText(input: unknown): string | undefined {
  if (input === undefined) return "";
  if (typeof input !== "string" || input.length > 40) return undefined;
  const text = normalizePhoneDigits(input).trim();
  if (!text) return "";
  // Parse the whole phone only: no prose, vanity letters, extensions or hidden characters.
  return /^\+?[0-9\s().-]+$/.test(text) ? text : undefined;
}

export function normalizeSignupPhone(
  input: unknown,
  country: unknown = DEFAULT_PHONE_COUNTRY,
): PhoneResult {
  const text = phoneText(input);
  if (text === undefined) return { error: "phone" };
  if (!text) return {};
  if (
    typeof country !== "string" ||
    !phoneCountries.includes(country as CountryCode)
  )
    return { error: "phone" };
  const number = parsePhoneNumberFromString(text, {
    defaultCountry: country as CountryCode,
    extract: false,
  });
  if (!number || number.ext || number.country !== country || !number.isValid())
    return { error: "phone" };
  return { phone: number.number };
}

export function normalizeInternationalPhone(input: unknown): PhoneResult {
  const text = phoneText(input);
  if (text === undefined) return { error: "phone" };
  if (!text) return {};
  if (!text.startsWith("+")) return { error: "phone" };
  const number = parsePhoneNumberFromString(text, { extract: false });
  if (!number?.country || number.ext || !number.isValid())
    return { error: "phone" };
  return { phone: number.number };
}

export function inferPhoneCountry(input: string): CountryCode | undefined {
  const text = phoneText(input);
  if (!text?.startsWith("+")) return undefined;
  const number = parsePhoneNumberFromString(text, { extract: false });
  return number?.isValid() && !number.ext ? number.country : undefined;
}
