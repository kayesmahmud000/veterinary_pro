"use client";
import Link from "next/link";
import { isAdministrativeRole } from "@/lib/workspace/navigation";
import { useState } from "react";
import { Search, ArrowRight } from "lucide-react";
import { courseListSchema } from "@vetralink/shared-types";
import { useAuth } from "@/components/auth/auth-provider";
import { getCourseMessages } from "@/lib/i18n/courses";
import { useCourseData } from "@/lib/courses/client";
import { CourseError, CourseLoading } from "./course-ui";
import { CourseCard } from "./course-card";
import { Button } from "@/components/ui/button";
import siteStyles from "@/lib/ui/site.styles";
import { cn } from "@/lib/ui/cn";
import styles from "./course.styles";

export function CourseCatalog() {
  const auth = useAuth(),
    { locale } = auth,
    t = getCourseMessages(locale),
    [search, setSearch] = useState(""),
    [query, setQuery] = useState(""),
    [cursors, setCursors] = useState([""]);
  const data = useCourseData(
    `?limit=20&search=${encodeURIComponent(query)}${cursors.at(-1) ? `&cursor=${cursors.at(-1)}` : ""}`,
    courseListSchema,
  );
  const administrative =
    !auth.checking &&
    !auth.error &&
    auth.user &&
    isAdministrativeRole(auth.user.role);
  const clear = () => {
    setSearch("");
    setQuery("");
    setCursors([""]);
  };
  return (
    <main
      id="main-content"
      data-course-catalog
      className={cn(siteStyles.container, styles.shell)}
    >
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div className="max-w-3xl">
          <span className={styles.badge}>{t.free}</span>
          <h1 className={`${styles.heading} mt-5`}>{t.discover}</h1>
          <p className="mb-0">{t.intro}</p>
        </div>
        <Link
          href={administrative ? "/admin/courses" : "/account/courses"}
          className={styles.link}
        >
          {administrative ? t.manageCourses : t.library}
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </header>
      <section
        className="rounded-2xl border border-solid border-line bg-[#eff4ec] p-5 sm:p-8"
        aria-labelledby="search-heading"
      >
        <h2
          id="search-heading"
          className="mb-2 text-xl font-semibold sm:text-2xl"
        >
          {t.search}
        </h2>
        <p className="mb-5">{t.searchHint}</p>
        <form
          className="flex w-full flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            setQuery(search.trim());
            setCursors([""]);
          }}
        >
          <div className="min-w-0 flex-1">
            <label
              htmlFor="course-search"
              className="mb-2 block text-sm font-semibold"
            >
              {t.searchLabel}
            </label>
            <div className="relative">
              <Search
                size={20}
                aria-hidden="true"
                className="pointer-events-none absolute left-4 top-4 text-muted"
              />
              <input
                type="search"
                id="course-search"
                name="search"
                maxLength={100}
                value={search}
                placeholder={t.searchPlaceholder}
                className={`${styles.input} pl-12`}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </div>
          <Button type="submit" className="min-h-12">
            {t.apply}
          </Button>
          {(query || search) && (
            <Button
              type="button"
              data-course-clear
              variant="outline"
              className="min-h-12"
              onClick={clear}
            >
              {t.clear}
            </Button>
          )}
        </form>
      </section>
      <section
        aria-label={t.courses}
        aria-busy={data.loading}
        className="space-y-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="mb-0 text-xl font-semibold">
            {query ? t.searchResults : t.allCourses}
          </h2>
          {!data.loading && !data.code && (
            <span role="status" className="text-sm text-muted">
              {new Intl.NumberFormat(locale).format(
                data.data?.items.length ?? 0,
              )}{" "}
              {t.coursesOnPage}
              {query && <span className="break-all"> · “{query}”</span>}
            </span>
          )}
        </div>
        {data.loading ? (
          <CourseLoading cards />
        ) : data.code ? (
          <CourseError code={data.code} retry={data.reload} />
        ) : !data.data?.items.length ? (
          <div
            data-course-empty
            className={`${styles.panel} space-y-4 text-center`}
          >
            <Search size={32} aria-hidden="true" className="text-green" />
            <h3>{query ? t.noResults : t.empty}</h3>
            <p>{query ? t.noResultsHint : t.checkBack}</p>
            {query && (
              <Button variant="outline" onClick={clear}>
                {t.clear}
              </Button>
            )}
          </div>
        ) : (
          <div className={styles.grid}>
            {data.data.items.map((course, index) => (
              <CourseCard
                key={course.id}
                course={course}
                href={
                  administrative
                    ? `/admin/courses/${course.id}`
                    : `/courses/${course.slug}`
                }
                action={administrative ? t.manageCourse : t.details}
                priority={index === 0}
              />
            ))}
          </div>
        )}
      </section>
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
    </main>
  );
}
