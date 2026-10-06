"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import type { PublicNavItem } from "@/lib/public-navigation";

export function MobileNavigation({
  items,
}: {
  items: readonly PublicNavItem[];
}) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const breakpoint = window.matchMedia("(min-width: 800px)");
    const close = () => setOpen(false);
    breakpoint.addEventListener("change", close);
    return () => breakpoint.removeEventListener("change", close);
  }, []);
  return (
    <div
      className="mobile-navigation"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          setOpen(false);
          button.current?.focus();
        }
      }}
    >
      <button
        ref={button}
        className="menu-toggle"
        aria-label={open ? "Close navigation" : "Open navigation"}
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen(!open)}
      >
        {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
      </button>
      <nav id="mobile-menu" hidden={!open} aria-label="Mobile navigation">
        {items.map((item) => (
          <Link key={item.href} href={item.href} onClick={() => setOpen(false)}>
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
