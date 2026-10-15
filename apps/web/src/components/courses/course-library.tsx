"use client";
import Link from "next/link";
import { useState } from "react";
import { courseLibrarySchema } from "@vetralink/shared-types";
import { useAuth } from "@/components/auth/auth-provider";
import { getCourseMessages } from "@/lib/i18n/courses";
import { WorkspaceGate } from "@/components/workspace/workspace-gate";
import { useRemote } from "@/components/workspace/workspace-ui";
import { Button } from "@/components/ui/button";
import { CourseError } from "./course-ui";
import styles from "@/components/workspace/workspace.styles";
function Library() {
  const auth = useAuth(),
    t = getCourseMessages(auth.locale),
    [cursors, setCursors] = useState([""]),
    cursor = cursors.at(-1),
    data = useRemote(
      `me/courses?limit=20${cursor ? `&cursor=${cursor}` : ""}`,
      courseLibrarySchema,
    );
  return (
    <div data-course-library className="space-y-5">
      <Link href="/courses" className={styles.secondary}>
        {t.browse}
      </Link>
      {data.loading ? (
        <p role="status">{t.loading}</p>
      ) : data.code ? (
        <CourseError code={data.code} retry={data.reload} />
      ) : !data.data?.items.length ? (
        <p>{t.libraryEmpty}</p>
      ) : (
        data.data.items.map((course) => (
          <article key={course.id} className={`${styles.card} space-y-4`}>
            <h2>{course.title}</h2>
            <p>
              {course.lessonCount} {t.outOf}
            </p>
            {course.firstLessonId && (
              <Link
                href={`/account/courses/${course.id}/lessons/${course.firstLessonId}`}
                className={styles.primary}
              >
                {t.continue}
              </Link>
            )}
          </article>
        ))
      )}
      <div className={styles.actions}>
        {cursors.length > 1 && (
          <Button
            variant="outline"
            disabled={data.loading}
            onClick={() => setCursors((v) => v.slice(0, -1))}
          >
            {t.previous}
          </Button>
        )}
        {data.data?.nextCursor && (
          <Button
            variant="outline"
            disabled={data.loading}
            onClick={() => setCursors((v) => [...v, data.data!.nextCursor!])}
          >
            {t.next}
          </Button>
        )}
      </div>
    </div>
  );
}
export function CourseLibrary() {
  const t = getCourseMessages(useAuth().locale);
  return (
    <main id="main-content" className={styles.shell}>
      <h1 className={styles.heading}>{t.library}</h1>
      <WorkspaceGate>
        <Library />
      </WorkspaceGate>
    </main>
  );
}
