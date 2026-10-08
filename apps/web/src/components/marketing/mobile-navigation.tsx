"use client";

import { cn } from "@/lib/ui/cn";
import siteStyles from "@/lib/ui/site.styles";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Menu, X } from "lucide-react";
import {
  isPublicNavGroupActive,
  isPublicNavItemActive,
  type PublicNavGroup,
} from "@/lib/public-navigation";
import { usePublicNavLocation } from "./use-public-nav-location";
import { AuthControls } from "@/components/auth/auth-controls";

export function MobileNavigation({
  items,
  labels,
}: {
  items: readonly PublicNavGroup[];
  labels: { open: string; close: string; mobile: string };
}) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const { pathname, hash } = usePublicNavLocation();
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const breakpoint = window.matchMedia("(min-width: 1280px)");
    const close = () => setOpen(false);
    breakpoint.addEventListener("change", close);
    return () => breakpoint.removeEventListener("change", close);
  }, []);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  return (
    <div
      ref={container}
      className={cn(siteStyles["mobile-navigation"])}
      onBlurCapture={(event) => {
        if (
          event.relatedTarget &&
          !event.currentTarget.contains(event.relatedTarget)
        ) {
          setOpen(false);
        }
      }}
    >
      <button
        ref={button}
        className={cn(siteStyles["menu-toggle"])}
        aria-label={open ? labels.close : labels.open}
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen(!open)}
      >
        {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
      </button>
      <nav
        id="mobile-menu"
        hidden={!open}
        aria-label={labels.mobile}
        className="max-h-[calc(100dvh_-_76px)] overflow-y-auto overscroll-contain"
      >
        {items.map((item) =>
          item.children ? (
            <details
              key={item.href}
              className="group border-x-0 border-t-0 border-b border-solid border-line py-1"
            >
              <summary
                data-active={
                  isPublicNavGroupActive(item, pathname, hash) ? "" : undefined
                }
                aria-current={
                  isPublicNavGroupActive(item, pathname, hash)
                    ? "location"
                    : undefined
                }
                className="flex min-h-12 cursor-pointer list-none items-center justify-between rounded-lg px-3 font-semibold data-[active]:!text-[#a26913] [&::-webkit-details-marker]:hidden"
              >
                {item.label}
                <ChevronDown
                  size={16}
                  aria-hidden="true"
                  className="transition-transform group-open:rotate-180"
                />
              </summary>
              <div className="rounded-lg bg-paper px-4 pb-2">
                {item.children.map((child) => (
                  <Link
                    key={child.href}
                    href={child.href}
                    onClick={() => setOpen(false)}
                    data-active={
                      isPublicNavItemActive(child.href, pathname, hash)
                        ? ""
                        : undefined
                    }
                    aria-current={
                      isPublicNavItemActive(child.href, pathname, hash)
                        ? child.href.includes("#")
                          ? "location"
                          : "page"
                        : undefined
                    }
                    className="rounded-lg px-3 text-sm data-[active]:!text-[#a26913]"
                  >
                    {child.label}
                  </Link>
                ))}
              </div>
            </details>
          ) : (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              data-active={
                isPublicNavItemActive(item.href, pathname, hash)
                  ? ""
                  : undefined
              }
              aria-current={
                isPublicNavItemActive(item.href, pathname, hash)
                  ? item.href.includes("#")
                    ? "location"
                    : "page"
                  : undefined
              }
              className="rounded-lg px-3 data-[active]:!text-[#a26913]"
            >
              {item.label}
            </Link>
          ),
        )}
        <AuthControls mobile onOpen={() => setOpen(false)} />
      </nav>
    </div>
  );
}
