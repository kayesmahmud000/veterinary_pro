"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  getCountryCallingCode,
  getExampleNumber,
  type CountryCode,
} from "libphonenumber-js/max";
import examples from "libphonenumber-js/examples.mobile.json";
import {
  inferPhoneCountry,
  normalizeSignupPhone,
  phoneCountries,
} from "@/lib/auth/phone";
import type { AuthMessages } from "@/lib/i18n/auth";
import type { Locale } from "@/lib/i18n/locale";
import { cn } from "@/lib/ui/cn";
import styles from "./auth.styles";

export function PhoneField({
  value,
  country,
  onChange,
  onCountryChange,
  copy,
  locale,
  error,
}: {
  value: string;
  country: CountryCode;
  onChange: (value: string) => void;
  onCountryChange: (country: CountryCode) => void;
  copy: AuthMessages;
  locale: Locale;
  error?: string;
}) {
  const [touched, setTouched] = useState(false);
  const countries = useMemo(() => {
    const names = new Intl.DisplayNames([locale], { type: "region" });
    return phoneCountries
      .map((code) => ({ code, name: names.of(code) ?? code }))
      .sort((a, b) =>
        a.code === "BD"
          ? -1
          : b.code === "BD"
            ? 1
            : a.name.localeCompare(b.name, locale),
      );
  }, [locale]);
  const countryName =
    countries.find((item) => item.code === country)?.name ?? country;
  const example = getExampleNumber(country, examples)?.formatNational();
  const issue =
    error ??
    (touched && normalizeSignupPhone(value, country).error
      ? copy.fields.phone
      : undefined);
  const flag = String.fromCodePoint(
    ...Array.from(country, (char) => char.charCodeAt(0) + 127397),
  );
  return (
    <div className={cn(styles.field, "auth-field")}>
      <label htmlFor="auth-phone">{copy.phone}</label>
      <div className="flex min-w-0 gap-2">
        <div className="relative w-[108px] shrink-0">
          <label htmlFor="auth-phone-country" className="sr-only">
            {copy.phoneCountry}
          </label>
          <select
            id="auth-phone-country"
            name="phoneCountry"
            value={country}
            onChange={(event) =>
              onCountryChange(event.target.value as CountryCode)
            }
            aria-describedby="auth-phone-hint"
            className="appearance-none !pl-2 !pr-6 !text-transparent [&_option]:text-ink"
          >
            {countries.map((item) => (
              <option key={item.code} value={item.code}>
                {item.name} (+{getCountryCallingCode(item.code)})
              </option>
            ))}
          </select>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-2 flex items-center gap-1 text-sm text-ink"
          >
            <span>{flag}</span>
            <span>+{getCountryCallingCode(country)}</span>
          </span>
          <ChevronDown
            size={14}
            aria-hidden="true"
            className="pointer-events-none absolute right-2 top-[17px] text-muted"
          />
        </div>
        <input
          id="auth-phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder={example}
          value={value}
          maxLength={40}
          onChange={(event) => {
            const next = event.target.value;
            const detected = inferPhoneCountry(next);
            if (detected) onCountryChange(detected);
            onChange(next);
          }}
          onBlur={() => setTouched(true)}
          aria-invalid={issue ? true : undefined}
          aria-describedby={`auth-phone-hint${issue ? " auth-phone-error" : ""}`}
          className="!w-0 flex-1 !px-2 !text-sm"
        />
      </div>
      {issue && (
        <span
          id="auth-phone-error"
          role="status"
          className={cn(styles.fieldError)}
        >
          {issue}
        </span>
      )}
      <span id="auth-phone-hint" className={cn(styles.hint)}>
        {countryName}
        {example ? ` · ${copy.phoneExample}: ${example}` : ""}
        <span className="mt-1 block">{copy.phoneHint}</span>
      </span>
    </div>
  );
}
