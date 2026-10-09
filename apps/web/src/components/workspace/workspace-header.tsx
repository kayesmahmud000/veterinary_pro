"use client";
import { Menu } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { LanguageSwitcher } from "@/components/marketing/language-switcher";
import { getWorkspaceShellMessages } from "@/lib/i18n/workspace-shell";

export function WorkspaceHeader({
  languageLabel,
  onMenu,
  menuOpen,
}: {
  languageLabel: string;
  onMenu: () => void;
  menuOpen: boolean;
}) {
  const auth = useAuth(),
    t = getWorkspaceShellMessages(auth.locale);
  return (
    <header className="sticky top-0 z-20 border-x-0 border-t-0 border-b border-solid border-line bg-white py-3">
      <div className="box-border flex w-full items-center justify-end gap-3 px-4 min-[640px]:px-6 min-[1024px]:px-8">
        <button
          data-workspace-menu-trigger
          type="button"
          aria-label={t.openMenu}
          aria-expanded={menuOpen}
          aria-controls="workspace-drawer"
          onClick={onMenu}
          className="mr-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-solid border-line bg-white min-[1024px]:hidden"
        >
          <Menu size={22} aria-hidden="true" />
        </button>
        <LanguageSwitcher locale={auth.locale} label={languageLabel} />
      </div>
    </header>
  );
}
