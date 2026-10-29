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
  if (data.loading)
    return (
      <div className="box-border flex aspect-video min-h-[200px] w-full items-center justify-center rounded-xl bg-paper p-4">
        <CourseLoading />
      </div>
    );
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
    demoPanel = useRef<HTMLElement>(null),
    demoTrigger = useRef<HTMLButtonElement | null>(null),
    restoreDemoFocus = useRef(false);
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
  const lesson = course.lessons.find((item) => item.id === selected),
    firstDemo = course.lessons.find((item) => item.access === "PUBLIC_DEMO");
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
    } else if (restoreDemoFocus.current) {
      restoreDemoFocus.current = false;
      const trigger = demoTrigger.current?.isConnected
        ? demoTrigger.current
        : enrollmentPanel.current?.querySelector<HTMLButtonElement>(
            "[data-course-demo-toggle]",
          );
      trigger?.focus();
    }
  }, [demo]);
  function openDemo(id: string, trigger: HTMLButtonElement) {
    demoTrigger.current = trigger;
    setSelected(null);
    setDemo(id);
    if (demo === id) {
      demoPanel.current?.focus();
      demoPanel.current?.scrollIntoView({ block: "start" });
    }
  }
  const demoAction = (
    <Button
      data-course-demo-toggle
      variant="outline"
      className="w-full min-w-0 whitespace-normal px-3"
      disabled={!firstDemo}
      title={!firstDemo ? t.noDemo : undefined}
      onClick={(event) =>
        firstDemo && openDemo(firstDemo.id, event.currentTarget)
      }
    >
      <Play size={17} aria-hidden="true" />
      {t.demoAction}
    </Button>
  );
  return (
    <>
      <header className="min-w-0 space-y-4">
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
      </header>
      <div
        data-course-detail-grid
        className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]"
      >
        <div data-course-media className={`${styles.panel} space-y-5`}>
          <div
            data-course-thumbnail
            hidden={!!demo}
            className="group relative isolate aspect-video min-h-[20rem] w-full min-w-0 overflow-hidden rounded-xl [&[hidden]]:hidden"
          >
            <div className="absolute inset-0 [&>[data-course-artwork]]:h-full [&>[data-course-artwork]]:aspect-auto">
              <CourseArtwork
                src={course.thumbnailUrl}
                title={course.title}
                priority
              />
            </div>
            <div
              data-course-thumbnail-overlay
              className="pointer-events-none absolute inset-0 box-border flex items-center justify-center bg-black/40 p-4 opacity-0 transition-opacity duration-150 group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100 motion-reduce:transition-none [@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-100"
            >
              <section
                ref={enrollmentPanel}
                tabIndex={-1}
                data-course-enrollment-panel
                aria-labelledby="enrollment-heading"
                className="box-border max-h-full w-full min-w-0 max-w-md space-y-4 overflow-y-auto rounded-xl bg-white/95 p-4"
              >
                <h2 id="enrollment-heading" className="sr-only">
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
                    <strong className="mt-1 block break-words">
                      {lesson.title}
                    </strong>
                    <p className="mb-0 mt-2">{t.locked}</p>
                  </div>
                )}
                {administrative ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <Link
                        data-course-management
                        href={`/admin/courses/${course.id}`}
                        className={cn(
                          buttonVariants(),
                          "w-full min-w-0 whitespace-normal px-3",
                        )}
                      >
                        {t.manageCourse}
                      </Link>
                      {demoAction}
                    </div>
                    <p className="m-0 text-sm text-muted">{t.administrator}</p>
                  </div>
                ) : auth.checking ||
                  (auth.user && !auth.error && membership.loading) ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        disabled
                        className="min-w-0 whitespace-normal px-3"
                      >
                        {t.enrollCourse}
                      </Button>
                      {demoAction}
                    </div>
                    <CourseLoading />
                  </div>
                ) : membership.code ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        disabled
                        className="min-w-0 whitespace-normal px-3"
                      >
                        {t.enrollCourse}
                      </Button>
                      {demoAction}
                    </div>
                    <CourseError
                      code={membership.code}
                      retry={membership.reload}
                    />
                  </div>
                ) : (
                  <EnrollmentButton
                    key={`${auth.user?.id ?? "public"}:${auth.user?.roleVersion ?? 0}`}
                    course={course}
                    enrolled={enrolled}
                    lessonId={selected ?? undefined}
                    compact
                    buttonLabel={t.enrollCourse}
                    secondaryAction={demoAction}
                  />
                )}
                {!firstDemo && (
                  <p role="status" className="m-0 text-sm text-muted">
                    {t.noDemo}
                  </p>
                )}
              </section>
            </div>
          </div>
          {demo ? (
            <section
              ref={demoPanel}
              tabIndex={-1}
              data-course-demo-panel
              className="min-w-0 space-y-4"
              aria-label={t.previewHeading}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="mb-0 text-lg font-semibold">
                  {t.previewHeading}
                </h2>
                <Button
                  data-course-close-demo
                  variant="outline"
                  onClick={() => {
                    restoreDemoFocus.current = true;
                    setDemo(null);
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
          ) : null}
        </div>
        <section
          data-course-outline
          className={`${styles.panel} space-y-4 lg:sticky lg:top-28`}
          aria-labelledby="curriculum-heading"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="curriculum-heading" className="mb-0 text-2xl font-semibold">
              {t.lessons}
            </h2>
            <span className={styles.badge}>
              {number.format(course.lessonCount)}
            </span>
          </div>
          <p className="m-0 text-sm text-muted">
            {enrolled ? t.available : t.publicPreview}
          </p>
          <ol className="m-0 max-h-[32rem] list-none divide-x-0 divide-y divide-solid divide-line overflow-y-auto rounded-xl border border-solid border-line bg-white p-0">
            {course.lessons.map((item) => (
              <li
                key={item.id}
                className="grid min-w-0 grid-cols-[2rem_minmax(0,1fr)] gap-3 p-4"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-paper text-sm font-semibold text-green">
                  {number.format(item.position)}
                </span>
                <div className="min-w-0 space-y-2">
                  <h3 className="m-0 break-words text-base font-semibold leading-snug">
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
                    <p className="m-0 break-words text-sm">{item.summary}</p>
                  )}
                </div>
                {administrative && item.access !== "PUBLIC_DEMO" ? (
                  <Link
                    className={cn(
                      buttonVariants({ variant: "outline" }),
                      "col-start-2 min-w-0 justify-self-start whitespace-normal px-3",
                    )}
                    href={`/admin/courses/${course.id}`}
                  >
                    {t.manageCourse}
                  </Link>
                ) : enrolled ? (
                  <Link
                    className={cn(
                      buttonVariants({ variant: "outline" }),
                      "col-start-2 min-w-0 justify-self-start whitespace-normal px-3",
                    )}
                    href={`/account/courses/${course.id}/lessons/${item.id}`}
                  >
                    {t.openLesson}
                  </Link>
                ) : item.access === "PUBLIC_DEMO" ? (
                  <Button
                    data-demo-lesson={item.id}
                    variant="outline"
                    className="col-start-2 min-w-0 justify-self-start whitespace-normal px-3"
                    onClick={(event) => openDemo(item.id, event.currentTarget)}
                  >
                    <Play size={16} aria-hidden="true" />
                    {t.watchDemo}
                  </Button>
                ) : (
                  <Button
                    data-locked-lesson={item.id}
                    variant="outline"
                    className="col-start-2 min-w-0 justify-self-start whitespace-normal px-3"
                    onClick={() => {
                      setDemo(null);
                      setSelected(item.id);
                      enrollmentPanel.current?.focus();
                      enrollmentPanel.current?.scrollIntoView({
                        block: "center",
                      });
                    }}
                  >
                    <LockKeyhole size={16} aria-hidden="true" />
                    {t.unlockLesson}
                  </Button>
                )}
              </li>
            ))}
          </ol>
        </section>
      </div>
      <section data-course-about className={`${styles.panel} space-y-4`}>
        <h2 className="mb-0 text-2xl font-semibold">{t.overview}</h2>
        <p className="mb-0 whitespace-pre-wrap break-words">
          {course.description}
        </p>
      </section>
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
