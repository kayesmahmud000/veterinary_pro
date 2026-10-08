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
    // Window listeners run in registration order. Register before Next's
    // passive router listener, including when entering a workspace from public pages.
    const pop = (event: PopStateEvent) => current.current?.(event);
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
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
