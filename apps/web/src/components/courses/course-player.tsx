"use client";
import Link from "next/link";
import { myCourseSchema, coursePlaybackSchema } from "@vetralink/shared-types";
import { useAuth } from "@/components/auth/auth-provider";
import { getCourseMessages } from "@/lib/i18n/courses";
import { WorkspaceGate } from "@/components/workspace/workspace-gate";
import { useRemote } from "@/components/workspace/workspace-ui";
import { CourseError, EnrollmentButton } from "./course-ui";
import { YouTubePlayer } from "./youtube-player";
import styles from "@/components/workspace/workspace.styles";
function Playback({ id, lessonId }: { id: string; lessonId: string }) {
  const auth = useAuth(),
    t = getCourseMessages(auth.locale),
    data = useRemote(
      `me/courses/${id}/lessons/${lessonId}/playback`,
      coursePlaybackSchema,
    );
  if (auth.checking || auth.error) return <p role="status">{t.loading}</p>;
  if (data.loading) return <p role="status">{t.loading}</p>;
  if (data.code || !data.data)
    return <CourseError code={data.code ?? "NOT_FOUND"} retry={data.reload} />;
  return <YouTubePlayer videoId={data.data.videoId} title={data.data.title} />;
}
function CourseWatch({ id, lessonId }: { id: string; lessonId: string }) {
  const auth = useAuth(),
    t = getCourseMessages(auth.locale),
    data = useRemote(`me/courses/${id}`, myCourseSchema),
    course = data.data;
  if (data.loading) return <p role="status">{t.loading}</p>;
  if (data.code || !course)
    return <CourseError code={data.code ?? "NOT_FOUND"} retry={data.reload} />;
  const index = course.lessons.findIndex((lesson) => lesson.id === lessonId),
    lesson = course.lessons[index];
  if (!lesson) return <CourseError code="NOT_FOUND" />;
  return (
    <div data-course-watch className="space-y-6">
      <Link href={`/courses/${course.slug}`} className={styles.secondary}>
        {t.back}
      </Link>
      <h2>{course.title}</h2>
      {!course.enrollment ? (
        <section className={`${styles.card} space-y-4`}>
          <p>{t.locked}</p>
          <EnrollmentButton
            course={course}
            enrolled={false}
            afterEnroll={data.reload}
          />
        </section>
      ) : (
        <>
          <h3 className="text-xl">{lesson.title}</h3>
          {!auth.checking && !auth.error && (
            <Playback key={`${id}:${lessonId}`} id={id} lessonId={lessonId} />
          )}
          <nav aria-label={t.lessons} className={styles.actions}>
            {index > 0 && (
              <Link
                className={styles.secondary}
                href={`/account/courses/${id}/lessons/${course.lessons[index - 1].id}`}
              >
                {t.previous}
              </Link>
            )}
            {index + 1 < course.lessons.length && (
              <Link
                className={styles.secondary}
                href={`/account/courses/${id}/lessons/${course.lessons[index + 1].id}`}
              >
                {t.next}
              </Link>
            )}
          </nav>
        </>
      )}
      <section className={styles.card}>
        <h2>{t.lessons}</h2>
        <ol className="space-y-3 pl-5">
          {course.lessons.map((item) => (
            <li key={item.id}>
              <Link
                aria-current={item.id === lessonId ? "page" : undefined}
                className="block min-h-11 rounded-lg px-3 py-2 text-green underline aria-[current=page]:bg-paper aria-[current=page]:font-bold"
                href={`/account/courses/${id}/lessons/${item.id}`}
              >
                {item.title} ·{" "}
                {item.access === "PUBLIC_DEMO" ? t.demo : t.enrolled}
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
export function CoursePlayer({
  id,
  lessonId,
}: {
  id: string;
  lessonId: string;
}) {
  const t = getCourseMessages(useAuth().locale);
  return (
    <main id="main-content" className={styles.shell}>
      <h1 className={styles.heading}>{t.courses}</h1>
      <WorkspaceGate>
        <CourseWatch key={id} id={id} lessonId={lessonId} />
      </WorkspaceGate>
    </main>
  );
}
