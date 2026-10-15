"use client";
import {cn} from "@/lib/ui/cn";
import siteStyles from "@/lib/ui/site.styles";
import Link from "next/link";
import { useState } from "react";
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
import { CourseError, EnrollmentButton } from "./course-ui";
import { YouTubePlayer } from "./youtube-player";
import { Button } from "@/components/ui/button";
import styles from "@/components/workspace/workspace.styles";
function Membership({ course }: { course: Course }) {
  const data = useRemote(`me/courses/${course.id}`, myCourseSchema),
    t = getCourseMessages(useAuth().locale);
  if (data.loading) return <p role="status">{t.loading}</p>;
  if (data.code || !data.data)
    return (
      <CourseError code={data.code ?? "UNAVAILABLE"} retry={data.reload} />
    );
  return <EnrollmentButton course={course} enrolled={!!data.data.enrollment} />;
}
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
    ),
    t = getCourseMessages(useAuth().locale);
  if (data.loading) return <p role="status">{t.loading}</p>;
  if (data.code || !data.data)
    return <CourseError code={data.code ?? "NOT_FOUND"} retry={data.reload} />;
  return <YouTubePlayer videoId={data.data.videoId} title={data.data.title} />;
}
export function CourseDetail({ slug }: { slug: string }) {
  const auth = useAuth(),
    t = getCourseMessages(auth.locale),
    data = useCourseData(`/slug/${encodeURIComponent(slug)}`, courseSchema),
    [demo, setDemo] = useState<string | null>(null),
    course = data.data;
  return (
    <main
      id="main-content"
      data-course-detail
      className={cn(siteStyles["container"],"min-h-[70vh] space-y-7 py-10 sm:py-16")}
    >
      <Link href="/courses" className={styles.secondary}>
        {t.browse}
      </Link>
      {data.loading ? (
        <p role="status">{t.loading}</p>
      ) : data.code || !course ? (
        <CourseError code={data.code ?? "NOT_FOUND"} retry={data.reload} />
      ) : (
        <>
          <header className="space-y-4">
            <p className="font-semibold text-green">{t.free}</p>
            <h1 className={styles.heading}>{course.title}</h1>
            <p className="whitespace-pre-wrap">{course.description}</p>
          </header>
          {!auth.checking && !auth.error && auth.user ? (
            <Membership
              key={`${auth.user.id}:${auth.user.roleVersion}`}
              course={course}
            />
          ) : (
            <EnrollmentButton course={course} enrolled={false} />
          )}
          <section className={`${styles.card} space-y-4`}>
            <h2>{t.lessons}</h2>
            <ol className="m-0 list-none space-y-3 p-0">
              {course.lessons.map((lesson) => (
                <li
                  key={lesson.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-solid border-line p-4"
                >
                  <div>
                    <strong>
                      {lesson.position}. {lesson.title}
                    </strong>
                    <p className="my-1 text-sm text-muted">
                      {lesson.access === "PUBLIC_DEMO" ? t.demo : t.enrolled}
                    </p>
                    {lesson.summary && <p className="my-1">{lesson.summary}</p>}
                  </div>
                  {lesson.access === "PUBLIC_DEMO" && (
                    <Button
                      data-demo-lesson={lesson.id}
                      variant="outline"
                      onClick={() => setDemo(lesson.id)}
                    >
                      {t.watchDemo}
                    </Button>
                  )}
                </li>
              ))}
            </ol>
          </section>
          {demo && (
            <section className={`${styles.card} space-y-4`}>
              <Button variant="outline" onClick={() => setDemo(null)}>
                {t.closeDemo}
              </Button>
              <Demo
                key={`${course.id}:${demo}`}
                productId={course.id}
                lessonId={demo}
              />
            </section>
          )}
        </>
      )}
    </main>
  );
}
