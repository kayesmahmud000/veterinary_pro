"use client";
import { useEffect, useLayoutEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getPostLoginDestination } from "@/lib/workspace/navigation";
import { useAuth } from "./auth-provider";

export function ProtectedEntry({ returnTo }: { returnTo: string }) {
  const auth = useAuth(),
    router = useRouter();
  const initial = useRef(true);
  useLayoutEffect(() => {
    if (initial.current) {
      initial.current = false;
      auth.open("login", returnTo, true);
    }
  }, [auth.open, returnTo]);
  useEffect(() => {
    // Restoration/rotation stays in the browser's cross-tab session lock.
    if (auth.checking || auth.error || !auth.user || !auth.modal) return;
    const destination = getPostLoginDestination(auth.user, returnTo);
    auth.close();
    router.replace(destination);
    router.refresh();
  }, [
    auth.checking,
    auth.error,
    auth.user,
    auth.modal,
    auth.close,
    returnTo,
    router,
  ]);
  return null;
}
