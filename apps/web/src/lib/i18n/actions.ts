"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isLocale, LOCALE_COOKIE } from "./locale";

export async function changeLocale(formData: FormData): Promise<void> {
  const locale = formData.get("locale");
  if (!isLocale(locale)) return;

  cookies().set(LOCALE_COOKIE, locale, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  // A fresh request reads the new cookie, including native forms without JavaScript.
  // Accept only an internal URL; never trust the hidden field as a redirect target.
  const returnTo = formData.get("returnTo");
  const base = "https://vetralink.invalid";
  if (
    typeof returnTo === "string" &&
    returnTo.startsWith("/") &&
    !returnTo.startsWith("//") &&
    !/[\\\u0000-\u001f\u007f]/.test(returnTo)
  ) {
    const destination = new URL(returnTo, base);
    if (destination.origin === base) {
      redirect(
        `${destination.pathname}${destination.search}${destination.hash}`,
      );
    }
  }
  redirect("/");
}
