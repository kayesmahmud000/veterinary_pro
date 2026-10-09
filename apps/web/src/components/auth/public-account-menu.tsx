"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, LogOut, UserRound } from "lucide-react";
import { getWorkspaceShellMessages } from "@/lib/i18n/workspace-shell";
import { useAuth } from "./auth-provider";

function avatarSource(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value, "https://avatar.invalid");
    return ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? value
      : null;
  } catch {
    return null;
  }
}

export function PublicAccountMenu({
  mobile = false,
  onNavigate,
}: {
  mobile?: boolean;
  onNavigate?: () => void;
}) {
  const auth = useAuth(),
    pathname = usePathname(),
    router = useRouter(),
    id = useId(),
    container = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  const [hovered, setHovered] = useState(false),
    [pinned, setPinned] = useState(false),
    [pending, setPending] = useState(false),
    [logoutError, setLogoutError] = useState(false),
    [failedAvatar, setFailedAvatar] = useState<string>();
  const expanded = hovered || pinned || pending;
  const user = auth.user;
  function close() {
    setHovered(false);
    setPinned(false);
  }
  useEffect(() => {
    setHovered(false);
    setPinned(false);
    setLogoutError(false);
  }, [pathname, user?.id]);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) {
        setHovered(false);
        setPinned(false);
      }
    };
    const breakpoint = window.matchMedia("(min-width: 1280px)");
    const reset = () => {
      setHovered(false);
      setPinned(false);
    };
    document.addEventListener("pointerdown", outside);
    breakpoint.addEventListener("change", reset);
    return () => {
      document.removeEventListener("pointerdown", outside);
      breakpoint.removeEventListener("change", reset);
    };
  }, []);
  if (!user) return null;
  const t = getWorkspaceShellMessages(auth.locale),
    learner = user.role === "LEARNER",
    source = avatarSource(user.avatarUrl),
    initials = user.name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => Array.from(part)[0])
      .join("");
  const DestinationIcon = learner ? UserRound : LayoutDashboard;
  async function logout() {
    if (pending) return;
    setPending(true);
    setLogoutError(false);
    const result = await auth.mutate("logout");
    setPending(false);
    if (result.code) {
      setLogoutError(true);
      setPinned(true);
    } else {
      close();
      onNavigate?.();
      router.refresh();
    }
  }
  return (
    <div
      ref={container}
      data-public-account
      className={mobile ? "relative w-full" : "relative"}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setHovered(true);
      }}
      onPointerLeave={(event) => {
        if (
          event.pointerType === "mouse" &&
          !event.currentTarget.contains(document.activeElement)
        )
          setHovered(false);
      }}
      onBlurCapture={(event) => {
        if (
          event.relatedTarget &&
          !event.currentTarget.contains(event.relatedTarget)
        )
          close();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && expanded && !pending) {
          event.preventDefault();
          event.stopPropagation();
          close();
          trigger.current?.focus();
        }
      }}
    >
      <button
        ref={trigger}
        data-avatar-trigger
        type="button"
        aria-label={`${auth.messages.account}: ${user.name}`}
        aria-expanded={expanded}
        aria-controls={id}
        onClick={() => setPinned(!pinned)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setPinned(true);
            requestAnimationFrame(() =>
              container.current?.querySelector("a")?.focus(),
            );
          }
        }}
        className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-solid border-line bg-paper p-0 text-sm font-semibold text-green focus-visible:outline-offset-2"
      >
        {source && source !== failedAvatar ? (
          <img
            src={source}
            alt=""
            width={44}
            height={44}
            referrerPolicy="no-referrer"
            onError={() => setFailedAvatar(source)}
            className="h-full w-full object-cover"
          />
        ) : (
          <span aria-hidden="true">{initials || <UserRound size={22} />}</span>
        )}
      </button>
      {expanded && (
        <div
          id={id}
          data-public-account-panel
          className={
            mobile
              ? "pt-2"
              : "absolute right-0 top-full z-40 w-[min(240px,calc(100vw_-_32px))] pt-2"
          }
        >
          <div className="rounded-xl border border-solid border-line bg-white p-2 text-ink shadow-lg">
            <Link
              data-profile-link={learner ? "" : undefined}
              data-account-destination
              href={learner ? "/account/profile" : "/dashboard"}
              onClick={() => {
                close();
                onNavigate?.();
              }}
              className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-ink hover:bg-paper focus-visible:outline-offset-2"
            >
              <DestinationIcon size={18} aria-hidden="true" />
              {learner ? t.profile : t.dashboard}
            </Link>
            <button
              data-public-signout
              type="button"
              disabled={pending}
              onClick={() => void logout()}
              className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-lg border-0 bg-transparent px-3 py-2 text-left text-sm font-semibold text-ink hover:bg-paper disabled:cursor-wait disabled:opacity-50 focus-visible:outline-offset-2"
            >
              <LogOut size={18} aria-hidden="true" />
              {pending ? auth.messages.signingOut : auth.messages.signOut}
            </button>
            {logoutError && (
              <p role="alert" className="m-0 px-3 py-2 text-sm text-[#87271f]">
                {auth.messages.errors.unavailable}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
