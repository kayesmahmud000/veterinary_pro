"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { AuthUserSummary } from "@vetralink/shared-types";
import type { AuthErrorCode, AuthMode, AuthResult } from "@/lib/auth/contracts";
import type { AuthMessages } from "@/lib/i18n/auth";
import type { Locale } from "@/lib/i18n/locale";
import { usePathname } from "next/navigation";
import { authRequest, withSessionLock } from "@/lib/auth/client";
import { AuthDialog } from "./auth-dialog";
import { validateWorkspaceReturnTo } from "@/lib/workspace/navigation";

type Modal = AuthMode | "account" | null;
type AuthContextValue = {
  user: AuthUserSummary | null;
  checking: boolean;
  error?: AuthErrorCode;
  modal: Modal;
  returnTo?: string;
  protectedEntry: boolean;
  messages: AuthMessages;
  locale: Locale;
  open: (
    mode: Exclude<Modal, null>,
    returnTo?: string,
    protectedEntry?: boolean,
  ) => void;
  close: () => void;
  restore: () => Promise<void>;
  mutate: (
    action: AuthMode | "logout",
    payload?: unknown,
  ) => Promise<AuthResult>;
};
const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("AuthProvider is required");
  return context;
}

export function AuthProvider({
  children,
  messages,
  locale,
}: {
  children: ReactNode;
  messages: AuthMessages;
  locale: Locale;
}) {
  const [user, setUser] = useState<AuthUserSummary | null>(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<AuthErrorCode>();
  const [modal, setModal] = useState<Modal>(null);
  const [returnTo, setReturnTo] = useState<string>();
  const [protectedEntry, setProtectedEntry] = useState(false);
  const pathname = usePathname();
  const channel = useRef<BroadcastChannel | null>(null);
  const close = useCallback(() => {
    setModal(null);
    setReturnTo(undefined);
    setProtectedEntry(false);
  }, []);
  const open = useCallback(
    (mode: Exclude<Modal, null>, destination?: string, required = false) => {
      setReturnTo(validateWorkspaceReturnTo(destination) ?? undefined);
      setProtectedEntry(required);
      setModal(mode);
    },
    [],
  );
  useEffect(() => {
    // Logout can clear identity before its Home transition finishes.
    if (protectedEntry && pathname === "/") close();
  }, [protectedEntry, pathname, close]);

  const restore = useCallback(async () => {
    setChecking(true);
    await withSessionLock(async () => {
      // Read fresh cookies after acquiring the lock: another tab may already have rotated.
      let result = await authRequest("session");
      if (result.status === 401) result = await authRequest("refresh");
      if (result.ok || result.status === 401) setUser(result.data.user);
      setError(result.ok ? undefined : result.data.code);
    });
    setChecking(false);
  }, []);

  const mutate = useCallback(
    async (action: AuthMode | "logout", payload?: unknown) => {
      return withSessionLock(async () => {
        const result = await authRequest(action, payload);
        if (result.ok) {
          setUser(result.data.user);
          setError(undefined);
          channel.current?.postMessage("session-changed");
        }
        return result.data;
      });
    },
    [],
  );

  useEffect(() => {
    void restore();
    if (typeof BroadcastChannel !== "undefined") {
      channel.current = new BroadcastChannel("vetralink-auth-events");
      channel.current.onmessage = () => {
        void restore();
      };
    }
    const onVisible = () => {
      if (document.visibilityState === "visible") void restore();
    };
    document.addEventListener("visibilitychange", onVisible);
    const onSessionUpdated = () => {
      channel.current?.postMessage("session-changed");
      void restore();
    };
    window.addEventListener("vetralink-session-updated", onSessionUpdated);
    return () => {
      channel.current?.close();
      channel.current = null;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("vetralink-session-updated", onSessionUpdated);
    };
  }, [restore]);

  return (
    <AuthContext.Provider
      value={{
        user,
        checking,
        error,
        modal,
        returnTo,
        protectedEntry,
        messages,
        locale,
        open,
        close,
        restore,
        mutate,
      }}
    >
      {children}
      {modal && <AuthDialog />}
    </AuthContext.Provider>
  );
}
