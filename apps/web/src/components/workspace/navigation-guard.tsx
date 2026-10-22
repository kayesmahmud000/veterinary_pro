"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useRef,
  type ReactNode,
} from "react";

type PopGuard = (event: PopStateEvent) => void;
const entryIndexKey = "__vetralinkEntryIndex";
export function historyEntryIndex(): number | undefined {
  const index = history.state?.[entryIndexKey];
  return typeof index === "number" ? index : undefined;
}
const NavigationGuardContext = createContext<
  ((guard: PopGuard) => () => void) | null
>(null);

export function NavigationGuardProvider({ children }: { children: ReactNode }) {
  const current = useRef<PopGuard>();
  const register = useCallback((guard: PopGuard) => {
    current.current = guard;
    return () => {
      if (current.current === guard) current.current = undefined;
    };
  }, []);
  useLayoutEffect(() => {
    // Number same-document entries for browsers without the Navigation API.
    // Preserve Next's state, and restore cancelled traversals with go(), never
    // pushState(), which would truncate the user's Forward history.
    const push = history.pushState,
      replace = history.replaceState;
    let lastIndex = historyEntryIndex() ?? 0,
      lastState = history.state;
    const pushIndexed: History["pushState"] = function (data, unused, url) {
      const index = (historyEntryIndex() ?? lastIndex) + 1;
      push.call(history, { ...data, [entryIndexKey]: index }, unused, url);
      lastIndex = index;
      lastState = history.state;
    };
    const replaceIndexed: History["replaceState"] = function (
      data,
      unused,
      url,
    ) {
      replace.call(
        history,
        { ...data, [entryIndexKey]: historyEntryIndex() ?? lastIndex },
        unused,
        url,
      );
      lastState = history.state;
    };
    history.pushState = pushIndexed;
    history.replaceState = replaceIndexed;
    replaceIndexed(history.state, "");
    const hash = () => {
      if (historyEntryIndex() === undefined) {
        replace.call(
          history,
          { ...lastState, [entryIndexKey]: ++lastIndex },
          "",
        );
        lastState = history.state;
      }
    };
    // Window listeners run in registration order. Register before Next's
    // passive router listener, including when entering a workspace from public pages.
    const pop = (event: PopStateEvent) => {
      lastIndex = historyEntryIndex() ?? lastIndex;
      // Native anchors have null state before hashchange. Keep the current
      // Next tree so numbering the anchor doesn't turn it into a foreign entry.
      if (history.state) lastState = history.state;
      current.current?.(event);
    };
    window.addEventListener("popstate", pop);
    window.addEventListener("hashchange", hash);
    return () => {
      window.removeEventListener("popstate", pop);
      window.removeEventListener("hashchange", hash);
      if (history.pushState === pushIndexed) history.pushState = push;
      if (history.replaceState === replaceIndexed)
        history.replaceState = replace;
    };
  }, []);
  return (
    <NavigationGuardContext.Provider value={register}>
      {children}
    </NavigationGuardContext.Provider>
  );
}

export function useNavigationGuard() {
  const register = useContext(NavigationGuardContext);
  if (!register) throw new Error("NavigationGuardProvider is required");
  return register;
}
