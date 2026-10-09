"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Menu, UserRound, LogOut } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { SiteBrand } from "@/components/brand/site-brand";
import { LanguageSwitcher } from "@/components/marketing/language-switcher";
import { Button } from "@/components/ui/button";
import { getWorkspaceShellMessages } from "@/lib/i18n/workspace-shell";
import {
  getWorkspaceNav,
  isWorkspaceNavActive,
} from "@/lib/workspace/navigation";
import { useFarmContext } from "./farm-context";
import { getFarmWorkspaceNav } from "@/lib/workspace/farm-navigation";
import type { Messages } from "@/lib/i18n/en";

export function WorkspaceHeader({
  brand,
  homeLabel,
  languageLabel,
  onMenu,
  menuOpen,
}: {
  brand: Messages["brand"];
  homeLabel: string;
  languageLabel: string;
  onMenu: () => void;
  menuOpen: boolean;
}) {
  const auth = useAuth(),
    t = getWorkspaceShellMessages(auth.locale),
    pathname = usePathname(),
    router = useRouter();
  const query = useSearchParams().toString();
  const account = useRef<HTMLDetailsElement>(null);
  const [pending, setPending] = useState(false),
    [logoutError, setLogoutError] = useState(false);
  const identity = !auth.checking && !auth.error ? auth.user : null;
  const { farm } = useFarmContext();
  const entry = identity
    ? getWorkspaceNav(identity, auth.locale)[0]
    : undefined;
  const current = identity
    ? [
        ...getWorkspaceNav(identity, auth.locale),
        ...(farm ? getFarmWorkspaceNav(farm, auth.locale) : []),
      ]
        .reverse()
        .find((item) => isWorkspaceNavActive(item.href, pathname))
    : undefined;
  useEffect(() => {
    if (account.current) account.current.open = false;
    setLogoutError(false);
  }, [pathname, identity?.id]);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (account.current && !account.current.contains(event.target as Node))
        account.current.open = false;
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && account.current?.open) {
        account.current.open = false;
        account.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  async function logout() {
    if (pending) return;
    setPending(true);
    setLogoutError(false);
    const result = await auth.mutate("logout");
    setPending(false);
    if (result.code) setLogoutError(true);
    else {
      if (account.current) account.current.open = false;
      router.replace("/");
    }
  }
  return (
    <header className="sticky top-0 z-20 border-x-0 border-t-0 border-b border-solid border-line bg-white py-3">
      <div className="box-border flex w-full flex-wrap items-center gap-3 px-4 min-[640px]:px-6 min-[1024px]:px-8">
        <button
          data-workspace-menu-trigger
          type="button"
          aria-label={t.openMenu}
          aria-expanded={menuOpen}
          aria-controls="workspace-drawer"
          onClick={onMenu}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-solid border-line bg-white min-[1024px]:hidden"
        >
          <Menu size={22} aria-hidden="true" />
        </button>
        <div className="min-w-0 flex-1 min-[1024px]:hidden">
          <SiteBrand name={brand.name} homeLabel={homeLabel} />
        </div>
        <div className="hidden min-w-0 flex-1 min-[1024px]:block">
          <Link href={entry?.href ?? "/"} className="text-sm text-muted">
            {entry?.label ?? t.home}
          </Link>
          {current && current.href !== entry?.href && (
            <span className="text-sm text-muted"> / {current.label}</span>
          )}
        </div>
        <div className="order-3 flex w-full items-center justify-end min-[640px]:order-none min-[640px]:w-auto">
          <LanguageSwitcher locale={auth.locale} label={languageLabel} />
        </div>
        {identity ? (
          <details
            ref={account}
            className="relative shrink-0"
            onBlurCapture={(event) => {
              if (
                event.relatedTarget &&
                !event.currentTarget.contains(event.relatedTarget)
              )
                event.currentTarget.open = false;
            }}
          >
            <summary
              aria-label={t.account}
              className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg border border-solid border-line px-3 [&::-webkit-details-marker]:hidden"
            >
              <UserRound size={19} aria-hidden="true" />
              <span className="hidden max-w-36 truncate text-sm min-[1280px]:block">
                {identity.name}
              </span>
            </summary>
            <div className="absolute right-0 top-full z-30 mt-2 w-[min(280px,calc(100vw_-_32px))] rounded-xl border border-solid border-line bg-white p-3 shadow-lg">
              <p className="m-0 break-words px-2 py-2 text-sm font-semibold">
                {identity.name}
              </p>
              {identity.role !== "LEARNER" && (
                <Link
                  className="flex min-h-11 items-center rounded-lg px-2 text-sm"
                  href="/dashboard"
                >
                  {t.dashboard}
                </Link>
              )}
              <Link
                className="flex min-h-11 items-center rounded-lg px-2 text-sm"
                href="/account/profile"
              >
                {t.profile}
              </Link>
              <button
                type="button"
                disabled={pending}
                onClick={() => void logout()}
                className="flex min-h-11 w-full items-center gap-2 rounded-lg border-0 bg-transparent px-2 text-left text-sm"
              >
                <LogOut size={17} aria-hidden="true" />
                {pending ? t.signingOut : t.signOut}
              </button>
              {logoutError && (
                <p className="px-2 text-sm text-[#87271f]" role="alert">
                  {auth.messages.errors.unavailable}
                </p>
              )}
            </div>
          </details>
        ) : (
          <Button
            data-auth-trigger
            disabled={auth.checking}
            variant="outline"
            onClick={() =>
              auth.open("login", query ? `${pathname}?${query}` : pathname, true)
            }
            className="max-[639px]:px-2"
          >
            <UserRound size={18} aria-hidden="true" />
            <span className="sr-only min-[640px]:not-sr-only">
              {auth.messages.signIn}
            </span>
          </Button>
        )}
      </div>
    </header>
  );
}
