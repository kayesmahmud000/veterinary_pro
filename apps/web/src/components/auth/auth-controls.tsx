"use client";

import { cn } from "@/lib/ui/cn";
import { UserRound } from "lucide-react";
import { useAuth } from "./auth-provider";
import styles from "./auth.styles";

export function AuthControls({
  mobile = false,
  onOpen,
}: {
  mobile?: boolean;
  onOpen?: () => void;
}) {
  const { user, checking, open, messages: t } = useAuth();
  function show(mode: "login" | "register" | "account") {
    onOpen?.();
    open(mode);
  }
  return (
    <div className={cn(mobile ? styles.mobileControls : styles.controls)}>
      <button
        type="button"
        data-auth-trigger
        className={cn(styles.headerSignIn)}
        disabled={checking}
        aria-haspopup="dialog"
        aria-label={checking ? t.checking : user ? t.account : t.signIn}
        onClick={() => show(user ? "account" : "login")}
      >
        <UserRound size={18} aria-hidden="true" />{" "}
        <span>{checking ? t.checking : user ? t.account : t.signIn}</span>
      </button>
      {!user && (
        <button
          type="button"
          className={cn(styles.headerSignUp)}
          disabled={checking}
          aria-haspopup="dialog"
          onClick={() => show("register")}
        >
          {t.signUp}
        </button>
      )}
    </div>
  );
}
