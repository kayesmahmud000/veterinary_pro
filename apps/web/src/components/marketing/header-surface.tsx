"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

export function HeaderSurface({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const overlay = pathname === "/";

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 16);
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("pageshow", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("pageshow", update);
    };
  }, [pathname]);

  return (
    <header
      className={`site-header${overlay ? " site-header--overlay" : ""}${scrolled ? " is-scrolled" : ""}`}
    >
      {children}
    </header>
  );
}
