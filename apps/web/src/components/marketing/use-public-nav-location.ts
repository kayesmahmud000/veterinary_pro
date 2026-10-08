"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function usePublicNavLocation() {
  const pathname = usePathname();
  const [hash, setHash] = useState("");
  useEffect(() => {
    const sync = () => setHash(window.location.hash);
    // Next Link uses pushState for same-page sections, which does not emit
    // hashchange. Observe same-page link intent as well as native history.
    const followSection = (event: MouseEvent) => {
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.shiftKey
      )
        return;
      const anchor =
        event.target instanceof Element
          ? event.target.closest("a[href]")
          : null;
      if (
        !(anchor instanceof HTMLAnchorElement) ||
        anchor.hasAttribute("download") ||
        (anchor.target && anchor.target !== "_self")
      )
        return;
      const url = new URL(anchor.href);
      if (url.origin === window.location.origin && url.pathname === pathname)
        setHash(url.hash);
    };
    sync();
    window.addEventListener("hashchange", sync);
    window.addEventListener("popstate", sync);
    document.addEventListener("click", followSection);
    return () => {
      window.removeEventListener("hashchange", sync);
      window.removeEventListener("popstate", sync);
      document.removeEventListener("click", followSection);
    };
  }, [pathname]);
  return { pathname, hash };
}
