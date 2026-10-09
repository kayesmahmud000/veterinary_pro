"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { SiteBrand } from "@/components/brand/site-brand";
import { WorkspaceNavigation } from "./workspace-navigation";
import { WorkspaceHeader } from "./workspace-header";
import { useAuth } from "@/components/auth/auth-provider";
import { getWorkspaceShellMessages } from "@/lib/i18n/workspace-shell";
import { FarmContextProvider } from "./farm-context";
import type { Messages } from "@/lib/i18n/en";

export function WorkspaceShell({
  messages,
  children,
}: {
  messages: Messages;
  children: ReactNode;
}) {
  const auth = useAuth(),
    t = getWorkspaceShellMessages(auth.locale),
    pathname = usePathname();
  const [open, setOpen] = useState(false),
    dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => setOpen(false), [pathname, auth.user?.id, auth.modal]);
  useEffect(() => {
    const breakpoint = window.matchMedia("(min-width: 1024px)");
    const close = () => setOpen(false);
    breakpoint.addEventListener("change", close);
    return () => breakpoint.removeEventListener("change", close);
  }, []);
  useEffect(() => {
    if (!open) {
      dialog.current?.close();
      return;
    }
    const element = dialog.current,
      opener = document.activeElement as HTMLElement | null;
    const locked = document.body.classList.contains("overflow-hidden");
    element?.showModal();
    document.body.classList.add("overflow-hidden");
    return () => {
      element?.close();
      if (!locked) document.body.classList.remove("overflow-hidden");
      if (opener?.isConnected) opener.focus();
    };
  }, [open]);
  return (
    <FarmContextProvider>
      <div data-workspace-shell className="min-h-screen bg-paper">
        <div className="grid w-full grid-cols-[minmax(0,1fr)] min-[1024px]:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="sticky top-0 hidden h-screen min-w-0 flex-col gap-8 overflow-y-auto border-y-0 border-l-0 border-r border-solid border-line bg-white px-4 py-6 min-[1024px]:flex">
            <SiteBrand
              name={messages.brand.name}
              homeLabel={messages.navigation.home}
            />
            <WorkspaceNavigation />
          </aside>
          <div className="min-w-0">
            <WorkspaceHeader
              languageLabel={messages.navigation.language}
              onMenu={() => setOpen(true)}
              menuOpen={open}
            />
            <div className="min-w-0 px-4 py-2 min-[640px]:px-6 min-[1024px]:px-8">
              {children}
            </div>
          </div>
        </div>
        <dialog
          id="workspace-drawer"
          ref={dialog}
          data-workspace-drawer
          aria-label={t.navigation}
          onCancel={() => setOpen(false)}
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
          className="fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-[min(320px,calc(100vw_-_32px))] max-w-none rounded-r-2xl border-0 bg-white p-5 text-ink shadow-xl [&::backdrop]:bg-[#183f3280]"
        >
          <div className="flex min-h-full flex-col">
            <div className="mb-7 flex items-center gap-2">
              <SiteBrand
                name={messages.brand.name}
                homeLabel={messages.navigation.home}
              />
              <button
                type="button"
                aria-label={t.closeMenu}
                onClick={() => setOpen(false)}
                className="ml-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border-0 bg-transparent"
              >
                <X size={21} aria-hidden="true" />
              </button>
            </div>
            <WorkspaceNavigation mobile onNavigate={() => setOpen(false)} />
          </div>
        </dialog>
      </div>
    </FarmContextProvider>
  );
}
