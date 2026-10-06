"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { changeLocale } from "@/lib/i18n/actions";
import type { Locale } from "@/lib/i18n/locale";

export function LanguageSwitcher({
  locale,
  label,
}: {
  locale: Locale;
  label: string;
}) {
  const pathname = usePathname();
  const query = useSearchParams().toString();
  const returnTo = query ? `${pathname}?${query}` : pathname;
  return (
    <form
      action={changeLocale}
      className="language-switcher"
      aria-label={label}
    >
      <input type="hidden" name="returnTo" value={returnTo} />
      <button
        type="submit"
        name="locale"
        value="bn"
        lang="bn"
        aria-pressed={locale === "bn"}
      >
        বাং
      </button>
      <button
        type="submit"
        name="locale"
        value="en"
        lang="en"
        aria-pressed={locale === "en"}
      >
        ENG
      </button>
    </form>
  );
}
