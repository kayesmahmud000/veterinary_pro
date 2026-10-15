"use client";
import {cn} from "@/lib/ui/cn";
import siteStyles from "@/lib/ui/site.styles";
import Link from "next/link";
import { useState } from "react";
import { courseListSchema } from "@vetralink/shared-types";
import { useAuth } from "@/components/auth/auth-provider";
import { getCourseMessages } from "@/lib/i18n/courses";
import { useCourseData } from "@/lib/courses/client";
import { CourseError } from "./course-ui";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/workspace/workspace-ui";
import styles from "@/components/workspace/workspace.styles";
export function CourseCatalog() {
  const t = getCourseMessages(useAuth().locale),
    [search, setSearch] = useState(""),
    [query, setQuery] = useState(""),
    [cursors, setCursors] = useState([""]);
  const data = useCourseData(
    `?limit=20&search=${encodeURIComponent(query)}&${cursors.at(-1) ? `cursor=${cursors.at(-1)}` : ""}`,
    courseListSchema,
  );
  return (
    <main
      id="main-content"
      data-course-catalog
      className={cn(siteStyles["container"],"min-h-[70vh] space-y-7 py-10 sm:py-16")}
    >
      <header className="max-w-2xl space-y-4">
        <p className="text-sm font-semibold uppercase tracking-widest text-green">
          {t.free}
        </p>
        <h1 className={styles.heading}>{t.courses}</h1>
        <p>{t.intro}</p>
      </header>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          setQuery(search.trim());
          setCursors([""]);
        }}
      >
        <Field name="course-search" label={t.search}>
          <input
            id="course-search"
            maxLength={100}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </Field>
        <Button>{t.apply}</Button>
      </form>
      {data.loading ? (
        <p role="status">{t.loading}</p>
      ) : data.code ? (
        <CourseError code={data.code} retry={data.reload} />
      ) : !data.data?.items.length ? (
        <p>{t.empty}</p>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {data.data.items.map((course) => (
            <article
              data-course-card
              key={course.id}
              className={`${styles.card} space-y-4`}
            >
              <p className="text-sm font-semibold text-green">{t.free}</p>
              <h2>{course.title}</h2>
              <p className="line-clamp-3">{course.description}</p>
              <p>
                {course.lessonCount} {t.outOf} · {course.demoCount} {t.demo}
              </p>
              <Link
                className={styles.secondary}
                href={`/courses/${course.slug}`}
              >
                {t.details}
              </Link>
            </article>
          ))}
        </div>
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
    </main>
  );
}
