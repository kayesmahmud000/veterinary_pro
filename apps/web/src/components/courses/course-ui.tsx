"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { type Course, courseEnrollmentSchema } from "@vetralink/shared-types";
import { useAuth } from "@/components/auth/auth-provider";
import { workspaceRequest } from "@/lib/workspace/client";
import { getCourseMessages } from "@/lib/i18n/courses";
import { Button, buttonVariants } from "@/components/ui/button";
import styles from "./course.styles";
import { cn } from "@/lib/ui/cn";

export function CourseLoading({ cards = false }: { cards?: boolean }) {
  const t = getCourseMessages(useAuth().locale);
  return (
    <div role="status" className="space-y-5">
      <span className="inline-flex items-center gap-2 text-muted">
        <Loader2
          size={18}
          className="motion-safe:animate-spin"
          aria-hidden="true"
        />
        {t.loading}
      </span>
      {cards && (
        <div aria-hidden="true" className={styles.grid}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="overflow-hidden rounded-2xl border border-solid border-line"
            >
              <div className="aspect-video bg-[#eff4ec] motion-safe:animate-pulse" />
              <div className="space-y-4 p-6">
                <div className="h-5 w-2/3 rounded bg-line" />
                <div className="h-4 rounded bg-line" />
                <div className="h-4 w-4/5 rounded bg-line" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
export function CourseError({
  code,
  retry,
}: {
  code: string;
  retry?: () => void;
}) {
  const t = getCourseMessages(useAuth().locale);
  return (
    <div className={`${styles.panel} space-y-3`}>
      <p role="alert">
        {code === "NOT_FOUND"
          ? t.missing
          : code === "COURSE_ENROLLMENT_REQUIRED"
            ? t.locked
            : t.error}
      </p>
      {retry && (
        <Button variant="outline" onClick={retry}>
          {t.retry}
        </Button>
      )}
    </div>
  );
}
export function EnrollmentButton({
  course,
  enrolled,
  lessonId,
  afterEnroll,
  compact = false,
  secondaryAction,
  buttonLabel,
}: {
  course: Course;
  enrolled: boolean;
  lessonId?: string;
  afterEnroll?: () => void;
  compact?: boolean;
  secondaryAction?: ReactNode;
  buttonLabel?: string;
}) {
  const auth = useAuth(),
    t = getCourseMessages(auth.locale),
    router = useRouter();
  const [busy, setBusy] = useState(false),
    [code, setCode] = useState(""),
    [saved, setSaved] = useState(false);
  const submitting = useRef(false),
    active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const target =
    course.lessons.find((lesson) => lesson.id === lessonId)?.id ??
    course.firstLessonId;
  const destination = target
    ? `/account/courses/${course.id}/lessons/${target}`
    : "/account/courses";
  async function enroll() {
    if (submitting.current || auth.checking || auth.error) return;
    if (!auth.user) {
      auth.open("login", destination);
      return;
    }
    submitting.current = true;
    setBusy(true);
    setCode("");
    const result = await workspaceRequest(
      `me/courses/${course.id}/enrollment`,
      courseEnrollmentSchema,
      "POST",
      {},
      `${auth.user.id}:${auth.user.role}:${auth.user.roleVersion ?? 0}`,
    );
    if (!active.current) return;
    submitting.current = false;
    setBusy(false);
    if (result.data) {
      setSaved(true);
      if (afterEnroll) afterEnroll();
      else router.push(destination);
    } else setCode(result.code ?? "UNAVAILABLE");
  }
  const account =
    !(enrolled || saved) &&
    (auth.user ? (
      compact ? (
        <p className="m-0 break-words text-sm text-muted">
          {t.enrollmentAccount}:{" "}
          <strong className="text-ink">{auth.user.name}</strong>{" "}
          <span className="break-all">({auth.user.email})</span>
        </p>
      ) : (
        <div className="rounded-xl bg-paper p-4">
          <p className="mb-2 text-sm font-semibold">{t.enrollmentAccount}</p>
          <strong className="block break-words">{auth.user.name}</strong>
          <span className="block break-all text-sm text-muted">
            {auth.user.email}
          </span>
          <p className="mb-0 mt-2 text-sm">{t.enrollmentInfo}</p>
        </div>
      )
    ) : (
      <p className={compact ? "m-0 text-sm text-muted" : undefined}>
        {t.enrollmentSignIn}
      </p>
    ));
  const action =
    enrolled || saved ? (
      <Link
        className={cn(
          buttonVariants(),
          compact && "w-full min-w-0 whitespace-normal px-3",
        )}
        href={destination}
      >
        {t.continue}
      </Link>
    ) : (
      <Button
        data-course-enroll
        disabled={auth.checking || !!auth.error || busy}
        className={
          compact ? "w-full min-w-0 whitespace-normal px-3" : undefined
        }
        onClick={() => void enroll()}
      >
        {busy && (
          <Loader2
            size={18}
            className="motion-safe:animate-spin"
            aria-hidden="true"
          />
        )}
        {busy ? t.enrolling : (buttonLabel ?? t.enroll)}
      </Button>
    );
  return (
    <div
      className={compact ? "min-w-0 space-y-3" : "space-y-4"}
      data-course-enrollment
    >
      {!compact && account}
      {compact ? (
        <div className="grid grid-cols-2 gap-3">
          {action}
          {secondaryAction}
        </div>
      ) : (
        action
      )}
      {compact && account}
      {saved && <p role="status">{t.saved}</p>}
      {code && <p role="alert">{t.enrollmentError}</p>}
      {auth.error && (
        <div>
          <p role="alert">{t.membershipError}</p>
          <Button variant="outline" onClick={() => void auth.restore()}>
            {t.retry}
          </Button>
        </div>
      )}
      {!compact && <p className="mb-0 text-sm text-muted">{t.noPayment}</p>}
    </div>
  );
}
