"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-provider";
import { getAdminCourseMessages } from "@/lib/i18n/admin-courses";
export function AdminCourseDialog({
  title,
  children,
  close,
  busy = false,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    id = useId(),
    auth = useAuth(),
    t = getAdminCourseMessages(auth.locale);
  useEffect(() => {
    const element = ref.current,
      opener = document.activeElement as HTMLElement | null;
    const locked = document.body.classList.contains("overflow-hidden");
    if (auth.checking || auth.error) {
      element?.close();
      return;
    }
    element?.showModal();
    document.body.classList.add("overflow-hidden");
    return () => {
      element?.close();
      if (!locked) document.body.classList.remove("overflow-hidden");
      if (opener?.isConnected) opener.focus();
    };
  }, [auth.checking, auth.error]);
  return (
    <dialog
      ref={ref}
      data-admin-course-dialog
      aria-labelledby={id}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) close();
      }}
      className="fixed inset-0 m-auto max-h-[90dvh] w-[min(760px,calc(100vw_-_24px))] max-w-none overflow-y-auto rounded-2xl border border-solid border-line bg-white p-5 text-ink shadow-xl sm:p-7 [&::backdrop]:bg-[#183f3280]"
    >
      <div className="mb-6 flex items-start justify-between gap-4">
        <h2 id={id} className="mb-0 break-words text-2xl font-semibold">
          {title}
        </h2>
        <Button
          variant="ghost"
          className="shrink-0 px-3"
          disabled={busy}
          aria-label={t.closeDialog}
          onClick={close}
        >
          <X size={20} aria-hidden="true" />
        </Button>
      </div>
      {children}
    </dialog>
  );
}
