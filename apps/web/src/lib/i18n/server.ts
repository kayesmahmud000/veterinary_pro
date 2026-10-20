import { cache } from "react";
import { cookies } from "next/headers";
import { bn } from "./bn";
import { en } from "./en";
import { LOCALE_COOKIE, resolveLocale } from "./locale";

export const getLocalization = cache(async () => {
  const locale = resolveLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  return { locale, messages: locale === "bn" ? bn : en };
});
