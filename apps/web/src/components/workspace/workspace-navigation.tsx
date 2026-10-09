"use client";
import { useFarmContext } from "./farm-context";
import { getFarmWorkspaceNav } from "@/lib/workspace/farm-navigation";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  UserRound,
  ClipboardList,
  Sprout,
  ShieldCheck,
  HelpCircle,
  ArrowLeft,
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import {
  getWorkspaceNav,
  isWorkspaceNavActive,
  type WorkspaceNavItem,
} from "@/lib/workspace/navigation";
import { getWorkspaceShellMessages } from "@/lib/i18n/workspace-shell";
import { WorkspaceAccount } from "./workspace-account";

export function WorkspaceNavigation({
  mobile = false,
  onNavigate,
  extraItems = [],
}: {
  mobile?: boolean;
  onNavigate?: () => void;
  extraItems?: readonly WorkspaceNavItem[];
}) {
  const auth = useAuth(),
    pathname = usePathname(),
    t = getWorkspaceShellMessages(auth.locale);
  const { farm } = useFarmContext();
  const items =
    auth.user && !auth.checking && !auth.error
      ? [
          ...getWorkspaceNav(auth.user, auth.locale),
          ...extraItems,
          ...(farm ? getFarmWorkspaceNav(farm, auth.locale) : []),
        ]
      : [];
  return (
    <nav
      aria-label={t.navigation}
      data-workspace-nav={mobile ? "mobile" : "desktop"}
      className="flex min-w-0 flex-1 flex-col gap-1"
    >
      {items.map((item) => {
        const Icon =
          item.href === "/dashboard"
            ? LayoutDashboard
            : item.href === "/account/profile"
              ? UserRound
              : item.href.startsWith("/admin/")
                ? ShieldCheck
                : item.href === "/farm" || item.href.includes("farm-onboarding")
                  ? Sprout
                  : ClipboardList;
        const active =
          item.href === `/app/farms/${farm?.id}`
            ? pathname === item.href
            : isWorkspaceNavActive(item.href, pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            data-active={active ? "" : undefined}
            className="flex min-h-11 min-w-0 items-center gap-3 rounded-lg px-3 py-2 text-[.95rem] text-muted hover:text-ink data-[active]:!text-[#a26913] focus-visible:outline-offset-2"
          >
            <Icon size={19} aria-hidden="true" className="shrink-0" />
            <span className="[overflow-wrap:anywhere]">{item.label}</span>
          </Link>
        );
      })}
      <div className="my-4 border-x-0 border-t-0 border-b border-solid border-line" />
      <Link
        href="/help"
        onClick={onNavigate}
        className="flex min-h-11 items-center gap-3 px-3 py-2 text-sm text-muted"
      >
        <HelpCircle size={18} aria-hidden="true" />
        {t.help}
      </Link>
      <Link
        href="/"
        onClick={onNavigate}
        className="flex min-h-11 items-center gap-3 px-3 py-2 text-sm text-muted"
      >
        <ArrowLeft size={18} aria-hidden="true" />
        {t.website}
      </Link>
      <WorkspaceAccount onNavigate={onNavigate} />
    </nav>
  );
}
