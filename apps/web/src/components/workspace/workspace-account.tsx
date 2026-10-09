"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, UserRound } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { getWorkspaceShellMessages } from "@/lib/i18n/workspace-shell";

export function WorkspaceAccount({ onNavigate }: { onNavigate?: () => void }) {
  const auth = useAuth(),
    router = useRouter(),
    pathname = usePathname(),
    t = getWorkspaceShellMessages(auth.locale);
  const [pending, setPending] = useState(false),
    [logoutError, setLogoutError] = useState(false);
  const identity = !auth.checking && !auth.error ? auth.user : null;
  useEffect(() => setLogoutError(false), [pathname, identity?.id]);
  if (!identity) return null;

  async function logout() {
    if (pending) return;
    setPending(true);
    setLogoutError(false);
    const result = await auth.mutate("logout");
    setPending(false);
    if (result.code) setLogoutError(true);
    else {
      onNavigate?.();
      router.replace("/");
      router.refresh();
    }
  }

  return (
    <div data-workspace-account className="mt-auto pt-6">
      <div className="flex min-w-0 items-center gap-1 border-x-0 border-b-0 border-t border-solid border-line pt-4">
        <Link
          data-workspace-profile
          href="/account/profile"
          onClick={onNavigate}
          aria-current={pathname === "/account/profile" ? "page" : undefined}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-2 text-ink hover:text-green focus-visible:outline-offset-2"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-paper text-green">
            <UserRound size={22} aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">
              {identity.name}
            </span>
            <span className="block text-xs text-muted">{t.profile}</span>
          </span>
        </Link>
        <button
          data-workspace-signout
          type="button"
          disabled={pending}
          onClick={() => void logout()}
          aria-label={pending ? t.signingOut : t.signOut}
          title={pending ? t.signingOut : t.signOut}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border-0 bg-transparent text-muted hover:text-ink disabled:cursor-wait disabled:opacity-50 focus-visible:outline-offset-2"
        >
          <LogOut size={19} aria-hidden="true" />
        </button>
      </div>
      {logoutError && (
        <p className="m-0 px-2 pt-2 text-sm text-[#87271f]" role="alert">
          {auth.messages.errors.unavailable}
        </p>
      )}
    </div>
  );
}
