"use client";
import Link from "next/link";
import { useState } from "react";
import { BookOpen, ArrowRight } from "lucide-react";
import { courseLibrarySchema } from "@vetralink/shared-types";
import { useAuth } from "@/components/auth/auth-provider";
import { getCourseMessages } from "@/lib/i18n/courses";
import { WorkspaceGate } from "@/components/workspace/workspace-gate";
import { useRemote } from "@/components/workspace/workspace-ui";
import { Button, buttonVariants } from "@/components/ui/button";
import { CourseError, CourseLoading } from "./course-ui";
import { CourseCard } from "./course-card";
import styles from "./course.styles";
function Library() {
  const t = getCourseMessages(useAuth().locale),
    [cursors, setCursors] = useState([""]),
    cursor = cursors.at(-1);
  const data = useRemote(
    `me/courses?limit=20${cursor ? `&cursor=${cursor}` : ""}`,
    courseLibrarySchema,
  );
  return (
    <div data-course-library className="space-y-6">
      {data.loading ? (
        <CourseLoading cards />
      ) : data.code ? (
        <CourseError code={data.code} retry={data.reload} />
      ) : !data.data?.items.length ? (
        <section className={`${styles.panel} space-y-4 text-center`}>
          <BookOpen size={40} aria-hidden="true" className="text-green" />
          <h2 className="text-2xl">{t.libraryEmpty}</h2>
          <p>{t.intro}</p>
          <Link href="/courses" className={buttonVariants()}>
            {t.browse}
          </Link>
        </section>
      ) : (
        <div className={styles.grid}>
          {data.data.items.map((course, index) => (
            <CourseCard
              key={course.id}
              course={course}
              href={
                course.firstLessonId
                  ? `/account/courses/${course.id}/lessons/${course.firstLessonId}`
                  : `/courses/${encodeURIComponent(course.slug)}`
              }
              action={t.continue}
              priority={index === 0}
            />
          ))}
        </div>
      )}
      <nav aria-label={t.pagination} className="flex flex-wrap gap-3">
        {cursors.length > 1 && (
          <Button
            variant="outline"
            disabled={data.loading}
            onClick={() => setCursors((v) => v.slice(0, -1))}
          >
            {t.previous}
          </Button>
        )}
        {!data.loading && data.data?.nextCursor && (
          <Button
            variant="outline"
            onClick={() => setCursors((v) => [...v, data.data!.nextCursor!])}
          >
            {t.next}
          </Button>
        )}
      </nav>
    </div>
  );
}
export function CourseLibrary() {
  const t = getCourseMessages(useAuth().locale);
  return (
    <main id="main-content" className={styles.shell}>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className={styles.heading}>{t.library}</h1>
          <p className="mb-0 max-w-2xl">{t.libraryIntro}</p>
        </div>
        <Link href="/courses" className={styles.link}>
          {t.browse}
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </header>
      <WorkspaceGate>
        <Library />
      </WorkspaceGate>
    </main>
  );
}
