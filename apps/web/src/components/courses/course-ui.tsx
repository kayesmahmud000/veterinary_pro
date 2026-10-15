"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { type Course, courseEnrollmentSchema } from "@vetralink/shared-types";
import { useAuth } from "@/components/auth/auth-provider";
import { workspaceRequest } from "@/lib/workspace/client";
import { getCourseMessages } from "@/lib/i18n/courses";
import { Button } from "@/components/ui/button";
import styles from "@/components/workspace/workspace.styles";
export function CourseError({
  code,
  retry,
}: {
  code: string;
  retry?: () => void;
}) {
  const t = getCourseMessages(useAuth().locale);
  return (
    <div className={styles.error}>
      <p role="alert">{code === "NOT_FOUND" ? t.missing : t.error}</p>
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
  afterEnroll,
}: {
  course: Course;
  enrolled: boolean;
  afterEnroll?: () => void;
}) {
  const auth = useAuth(),
    t = getCourseMessages(auth.locale),
    router = useRouter(),
    [busy, setBusy] = useState(false),
    [code, setCode] = useState("");
  const destination = course.firstLessonId
    ? `/account/courses/${course.id}/lessons/${course.firstLessonId}`
    : "/account/courses";
  async function enroll() {
    if (busy) return;
    if (!auth.user) {
      auth.open("login", destination);
      return;
    }
    setBusy(true);
    setCode("");
    const result = await workspaceRequest(
      `me/courses/${course.id}/enrollment`,
      courseEnrollmentSchema,
      "POST",
      {},
    );
    setBusy(false);
    if (result.data) {
      if (afterEnroll) afterEnroll();
      else router.push(destination);
    } else setCode(result.code ?? "UNAVAILABLE");
  }
  return (
    <div className="space-y-3">
      {enrolled ? (
        <Link className={styles.primary} href={destination}>
          {t.continue}
        </Link>
      ) : (
        <Button
          data-course-enroll
          disabled={auth.checking || !!auth.error || busy}
          onClick={() => void enroll()}
        >
          {busy ? t.enrolling : t.enroll}
        </Button>
      )}
      {code && <CourseError code={code} />}
      <p className="text-sm text-muted">{t.noPayment}</p>
    </div>
  );
}
