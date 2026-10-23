"use client";
import Link from "next/link";
import { isAdministrativeRole } from "@/lib/workspace/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, BookOpen, LockKeyhole, Play, Check } from "lucide-react";
import {
  type Course,
  courseSchema,
  coursePlaybackSchema,
  myCourseSchema,
} from "@vetralink/shared-types";
import { useAuth } from "@/components/auth/auth-provider";
import { getCourseMessages } from "@/lib/i18n/courses";
import { useCourseData } from "@/lib/courses/client";
import { useRemote } from "@/components/workspace/workspace-ui";
import { CourseError, CourseLoading, EnrollmentButton } from "./course-ui";
import { CourseArtwork } from "./course-artwork";
import { YouTubePlayer } from "./youtube-player";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/ui/cn";
import siteStyles from "@/lib/ui/site.styles";
import styles from "./course.styles";

function Demo({
  productId,
  lessonId,
}: {
  productId: string;
  lessonId: string;
}) {
  const data = useCourseData(
    `/${productId}/lessons/${lessonId}/demo-playback`,
    coursePlaybackSchema,
  );
  if (data.loading) return <CourseLoading />;
  if (data.code || !data.data)
    return <CourseError code={data.code ?? "NOT_FOUND"} retry={data.reload} />;
  return <YouTubePlayer videoId={data.data.videoId} title={data.data.title} />;
}
function CourseOverview({ course }: { course: Course }) {
  const auth = useAuth(),
    t = getCourseMessages(auth.locale),
    number = new Intl.NumberFormat(auth.locale);
  const [demo, setDemo] = useState<string | null>(null),
    [selected, setSelected] = useState<string | null>(null);
  const enrollmentPanel = useRef<HTMLElement>(null),
    demoPanel = useRef<HTMLElement>(null);
  const administrative =
    !auth.checking &&
    !auth.error &&
    !!auth.user &&
    isAdministrativeRole(auth.user.role);
  const membership = useRemote(
    !auth.checking && !auth.error && auth.user && !administrative
      ? `me/courses/${course.id}`
      : null,
    myCourseSchema,
  );
  const enrolled =
    !auth.checking && !auth.error && !!membership.data?.enrollment;
  const lesson = course.lessons.find((item) => item.id === selected);
  useEffect(() => {
    if (selected) {
      enrollmentPanel.current?.focus();
      enrollmentPanel.current?.scrollIntoView({ block: "center" });
    }
  }, [selected]);
  useEffect(() => {
    if (demo) {
      demoPanel.current?.focus();
      demoPanel.current?.scrollIntoView({ block: "start" });
    }
  }, [demo]);
  return (
    <>
      <header className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.65fr)]">
        <div className="min-w-0 space-y-5">
          <span className={styles.badge}>{t.free}</span>
          <h1 className={styles.heading}>{course.title}</h1>
          <div className="flex flex-wrap gap-4 text-sm text-muted">
            <span className="inline-flex items-center gap-2">
              <BookOpen size={18} aria-hidden="true" />
              {number.format(course.lessonCount)} {t.outOf}
            </span>
            <span>
              {number.format(course.demoCount)} {t.demo}
            </span>
            <span>{t.learnAtPace}</span>
          </div>
          <div className="overflow-hidden rounded-2xl">
            <CourseArtwork
              src={course.thumbnailUrl}
              title={course.title}
              priority
            />
          </div>
        </div>
        <section
          ref={enrollmentPanel}
          tabIndex={-1}
          data-course-enrollment-panel
          aria-labelledby="enrollment-heading"
          className={`${styles.panel} space-y-5 lg:sticky lg:top-28`}
        >
          <h2 id="enrollment-heading" className="mb-0 text-2xl font-semibold">
            {administrative
              ? t.manageCourse
              : enrolled
                ? t.available
                : t.enrollmentHeading}
          </h2>
          {lesson && (
            <div role="status" className="rounded-xl bg-[#eff4ec] p-4">
              <span className="block text-sm text-muted">
                {t.selectedLesson}
              </span>
              <strong className="mt-1 block break-words">{lesson.title}</strong>
              <p className="mb-0 mt-2">{t.locked}</p>
            </div>
          )}
          {administrative ? (
            <div className="space-y-4">
              <p>{t.administrator}</p>
              <Link
                data-course-management
                href={`/admin/courses/${course.id}`}
                className={buttonVariants()}
              >
                {t.manageCourse}
              </Link>
            </div>
          ) : auth.checking ||
            (auth.user && !auth.error && membership.loading) ? (
            <CourseLoading />
          ) : membership.code ? (
            <CourseError code={membership.code} retry={membership.reload} />
          ) : (
            <EnrollmentButton
              key={`${auth.user?.id ?? "public"}:${auth.user?.roleVersion ?? 0}`}
              course={course}
              enrolled={enrolled}
              lessonId={selected ?? undefined}
            />
          )}
        </section>
      </header>
      <section className={`${styles.panel} space-y-4`}>
        <h2 className="mb-0 text-2xl font-semibold">{t.overview}</h2>
        <p className="mb-0 whitespace-pre-wrap break-words">
          {course.description}
        </p>
      </section>
      <section className="space-y-5" aria-labelledby="curriculum-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="curriculum-heading" className="mb-0 text-2xl font-semibold">
            {t.curriculum}
          </h2>
          <span className="text-sm text-muted">{t.publicPreview}</span>
        </div>
        <ol className="m-0 list-none divide-x-0 divide-y divide-solid divide-line overflow-hidden rounded-2xl border border-solid border-line bg-white p-0">
          {course.lessons.map((item) => (
            <li
              key={item.id}
              className="flex min-w-0 flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-paper font-semibold text-green">
                {number.format(item.position)}
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="mb-2 break-words text-lg font-semibold">
                  {item.title}
                </h3>
                <span className="inline-flex items-center gap-2 text-sm text-muted">
                  {administrative || enrolled ? (
                    <Check size={16} aria-hidden="true" />
                  ) : item.access === "PUBLIC_DEMO" ? (
                    <Play size={16} aria-hidden="true" />
                  ) : (
                    <LockKeyhole size={16} aria-hidden="true" />
                  )}
                  {administrative
                    ? t.manageCourse
                    : enrolled
                      ? t.available
                      : item.access === "PUBLIC_DEMO"
                        ? t.demo
                        : t.enrolled}
                </span>
                {item.summary && (
                  <p className="mb-0 mt-2 break-words text-sm">
                    {item.summary}
                  </p>
                )}
              </div>
              {administrative && item.access !== "PUBLIC_DEMO" ? (
                <Link
                  className={buttonVariants({ variant: "outline" })}
                  href={`/admin/courses/${course.id}`}
                >
                  {t.manageCourse}
                </Link>
              ) : enrolled ? (
                <Link
                  className={buttonVariants({ variant: "outline" })}
                  href={`/account/courses/${course.id}/lessons/${item.id}`}
                >
                  {t.openLesson}
                </Link>
              ) : item.access === "PUBLIC_DEMO" ? (
                <Button
                  data-demo-lesson={item.id}
                  variant="outline"
                  onClick={() => {
                    setSelected(null);
                    setDemo(item.id);
                  }}
                >
                  {t.watchDemo}
                </Button>
              ) : (
                <Button
                  data-locked-lesson={item.id}
                  variant="outline"
                  onClick={() => {
                    setDemo(null);
                    setSelected(item.id);
                    enrollmentPanel.current?.focus();
                    enrollmentPanel.current?.scrollIntoView({
                      block: "center",
                    });
                  }}
                >
                  {t.unlockLesson}
                </Button>
              )}
            </li>
          ))}
        </ol>
      </section>
      {demo && (
        <section
          ref={demoPanel}
          tabIndex={-1}
          className={`${styles.panel} space-y-5`}
          aria-label={t.previewHeading}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="mb-0 text-2xl font-semibold">{t.previewHeading}</h2>
            <Button
              variant="outline"
              onClick={() => {
                const trigger = document.querySelector<HTMLButtonElement>(
                  `[data-demo-lesson="${demo}"]`,
                );
                setDemo(null);
                trigger?.focus();
              }}
            >
              {t.closeDemo}
            </Button>
          </div>
          <Demo
            key={`${course.id}:${demo}`}
            productId={course.id}
            lessonId={demo}
          />
        </section>
      )}
    </>
  );
}
export function CourseDetail({ slug }: { slug: string }) {
  const auth = useAuth(),
    t = getCourseMessages(auth.locale),
    data = useCourseData(`/slug/${encodeURIComponent(slug)}`, courseSchema);
  return (
    <main
      id="main-content"
      data-course-detail
      className={cn(siteStyles.container, styles.shell)}
    >
      <Link href="/courses" className={styles.link}>
        <ArrowLeft size={18} aria-hidden="true" />
        {t.browse}
      </Link>
      {data.loading ? (
        <CourseLoading />
      ) : data.code || !data.data ? (
        <CourseError code={data.code ?? "NOT_FOUND"} retry={data.reload} />
      ) : (
        <CourseOverview
          key={`${data.data.id}:${auth.user?.id ?? "public"}:${auth.user?.roleVersion ?? 0}`}
          course={data.data}
        />
      )}
    </main>
  );
}
