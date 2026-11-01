"use client";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Play,
  BookOpen,
} from "lucide-react";
import { coursePlaybackSchema } from "@vetralink/shared-types";
import { useAuth } from "@/components/auth/auth-provider";
import { getCourseMessages } from "@/lib/i18n/courses";
import { useRemote } from "@/components/workspace/workspace-ui";
import { CourseError, CourseLoading, EnrollmentButton } from "./course-ui";
import { useLearningCourse } from "./course-learning-layout";
import { YouTubePlayer } from "./youtube-player";
import { buttonVariants } from "@/components/ui/button";
import styles from "./course.styles";
function Playback({ id, lessonId }: { id: string; lessonId: string }) {
  const data = useRemote(
    `me/courses/${id}/lessons/${lessonId}/playback`,
    coursePlaybackSchema,
  );
  if (data.loading)
    return (
      <div
        className={`${styles.panel} flex aspect-video min-h-[200px] w-full items-center justify-center`}
      >
        <CourseLoading />
      </div>
    );
  if (data.code || !data.data)
    return <CourseError code={data.code ?? "NOT_FOUND"} retry={data.reload} />;
  return <YouTubePlayer videoId={data.data.videoId} title={data.data.title} />;
}
export function CoursePlayer({
  id,
  lessonId,
}: {
  id: string;
  lessonId: string;
}) {
  const auth = useAuth(),
    t = getCourseMessages(auth.locale),
    { course, reload } = useLearningCourse(),
    number = new Intl.NumberFormat(auth.locale);
  const index = course.lessons.findIndex((lesson) => lesson.id === lessonId),
    lesson = course.lessons[index];
  if (!lesson) return <CourseError code="NOT_FOUND" />;
  return (
    <div data-course-watch className="space-y-6">
      <Link href="/account/courses" className={styles.link}>
        <ArrowLeft size={18} aria-hidden="true" />
        {t.backLibrary}
      </Link>
      <header>
        <Link href={`/courses/${encodeURIComponent(course.slug)}`} className={styles.link}>
          {t.back}
        </Link>
        <h1 className={`${styles.heading} mt-3`}>{course.title}</h1>
      </header>
      <div
        data-learning-columns
        className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]"
      >
        <section
          data-learning-main
          className="min-w-0 space-y-6"
          aria-label={lesson.title}
        >
          {!course.enrollment ? (
            <div className={`${styles.panel} space-y-4`}>
              <span className={styles.badge}>{t.free}</span>
              <h2 className="text-2xl">{t.enrollmentHeading}</h2>
              <p>{t.locked}</p>
              <p className="break-words">
                <strong>{t.selectedLesson}: </strong>
                {lesson.title}
              </p>
              <EnrollmentButton
                course={course}
                enrolled={false}
                lessonId={lessonId}
                afterEnroll={reload}
              />
            </div>
          ) : (
            <>
              {!auth.checking && !auth.error && (
                <Playback key={`${id}:${lessonId}`} id={id} lessonId={lessonId} />
              )}
              <div className={styles.panel}>
                <span className={styles.badge}>
                  {t.currentLesson} · {number.format(index + 1)} /{" "}
                  {number.format(course.lessons.length)}
                </span>
                <h2 className="mb-3 mt-5 break-words text-2xl font-semibold">
                  {lesson.title}
                </h2>
                {lesson.summary && (
                  <p className="mb-0 whitespace-pre-wrap break-words">
                    {lesson.summary}
                  </p>
                )}
              </div>
              <nav
                aria-label={t.lessonNavigation}
                className="flex flex-wrap justify-between gap-3"
              >
                {index > 0 && (
                  <Link
                    className={buttonVariants({ variant: "outline" })}
                    href={`/account/courses/${id}/lessons/${course.lessons[index - 1].id}`}
                  >
                    <ChevronLeft size={18} aria-hidden="true" />
                    {t.previous}
                  </Link>
                )}
                {index + 1 < course.lessons.length && (
                  <Link
                    className={`${buttonVariants()} ml-auto`}
                    href={`/account/courses/${id}/lessons/${course.lessons[index + 1].id}`}
                  >
                    {t.next}
                    <ChevronRight size={18} aria-hidden="true" />
                  </Link>
                )}
              </nav>
            </>
          )}
        </section>
        <aside
          data-course-curriculum
          aria-labelledby="lesson-list-heading"
          className={`${styles.panel} lg:sticky lg:top-6`}
        >
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 id="lesson-list-heading" className="mb-0 text-xl font-semibold">
              {t.lessons}
            </h2>
            <BookOpen size={20} aria-hidden="true" className="text-green" />
          </div>
          <ol className="m-0 list-none space-y-2 p-0 lg:max-h-[65vh] lg:overflow-y-auto lg:pr-2">
            {course.lessons.map((item) => (
              <li key={item.id}>
                <Link
                  aria-current={item.id === lessonId ? "page" : undefined}
                  className="flex min-h-16 gap-3 rounded-xl border border-solid border-line p-3 text-ink hover:bg-paper aria-[current=page]:border-green aria-[current=page]:bg-[#eff4ec]"
                  href={`/account/courses/${id}/lessons/${item.id}`}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-paper text-sm font-semibold">
                    {item.id === lessonId ? (
                      <Play size={16} aria-hidden="true" />
                    ) : (
                      number.format(item.position)
                    )}
                  </span>
                  <span className="min-w-0">
                    <strong className="block break-words text-sm">
                      {item.title}
                    </strong>
                    <span className="mt-1 block text-xs text-muted">
                      {item.id === lessonId && course.enrollment
                        ? t.currentLesson
                        : course.enrollment
                          ? t.available
                          : item.access === "PUBLIC_DEMO"
                            ? t.demo
                            : t.enrolled}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </div>
  );
}
