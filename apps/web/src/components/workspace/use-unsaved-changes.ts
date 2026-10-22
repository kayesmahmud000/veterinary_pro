"use client";

import { useCallback, useLayoutEffect, useRef } from "react";
import { historyEntryIndex, useNavigationGuard } from "./navigation-guard";

/** Protect in-memory drafts. Never store fields or credentials in browser storage. */
export function useUnsavedChanges(
  dirty: boolean,
  message: string,
  discard: () => void,
) {
  const register = useNavigationGuard();
  const discardRef = useRef(discard);
  useLayoutEffect(() => {
    discardRef.current = discard;
  });
  const confirmDiscard = useCallback(
    () => !dirty || window.confirm(message),
    [dirty, message],
  );
  useLayoutEffect(() => {
    if (!dirty) return;
    let source = new URL(location.href),
      sourceState = history.state;
    const navigation = (
      window as Window & { navigation?: { currentEntry?: { index: number } } }
    ).navigation;
    const index = () => navigation?.currentEntry?.index ?? historyEntryIndex();
    let sourceIndex = index();
    let restoring = false,
      leaving = false;
    const leave = () => {
      if (leaving) return true;
      if (!confirmDiscard()) return false;
      leaving = true;
      // Locale server actions can preserve the editor instance. Explicitly discard.
      discardRef.current();
      return true;
    };
    const cancel = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
    };
    const click = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link = (event.target as Element).closest?.(
        "a[href]",
      ) as HTMLAnchorElement | null;
      if (
        !link ||
        (link.target && link.target !== "_self") ||
        link.hasAttribute("download")
      )
        return;
      const target = new URL(link.href);
      if (
        target.origin === location.origin &&
        target.pathname === location.pathname &&
        target.search === location.search
      )
        return;
      // Full-document/external exits use only the native unload prompt.
      if (
        target.origin !== location.origin ||
        !["http:", "https:"].includes(target.protocol)
      )
        return;
      if (!leave()) cancel(event);
    };
    const submit = (event: SubmitEvent) => {
      const form = event.target;
      if (
        !(form instanceof HTMLFormElement) ||
        !form.hasAttribute("data-locale-switcher")
      )
        return;
      const button = event.submitter as HTMLButtonElement | null;
      if (!button || button.value === document.documentElement.lang) return;
      if (!leave()) cancel(event);
    };
    const pop = (event: PopStateEvent) => {
      if (restoring) {
        event.stopImmediatePropagation();
        restoring = false;
        return;
      }
      if (
        location.pathname === source.pathname &&
        location.search === source.search
      ) {
        rememberSource();
        return;
      }
      if (leave()) return;
      event.stopImmediatePropagation();
      const destinationIndex = index();
      if (
        sourceIndex !== undefined &&
        destinationIndex !== undefined &&
        sourceIndex !== destinationIndex
      ) {
        restoring = true;
        history.go(sourceIndex - destinationIndex);
      } else history.replaceState(sourceState, "", source.href);
    };
    const rememberSource = () => {
      source = new URL(location.href);
      sourceState = history.state;
      sourceIndex = index();
    };
    const before = (event: BeforeUnloadEvent) => {
      if (leaving) return;
      event.preventDefault();
      event.returnValue = "";
    };
    document.addEventListener("click", click, true);
    document.addEventListener("submit", submit, true);
    window.addEventListener("beforeunload", before);
    window.addEventListener("hashchange", rememberSource);
    const unregister = register(pop);
    return () => {
      document.removeEventListener("click", click, true);
      document.removeEventListener("submit", submit, true);
      window.removeEventListener("beforeunload", before);
      window.removeEventListener("hashchange", rememberSource);
      unregister();
    };
  }, [dirty, confirmDiscard, register]);
  return confirmDiscard;
}
