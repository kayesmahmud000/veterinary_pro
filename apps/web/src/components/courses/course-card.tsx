"use client";
import Link from "next/link";
import { ArrowUpRight, BookOpen, Play } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { getCourseMessages } from "@/lib/i18n/courses";
import { CourseArtwork } from "./course-artwork";
import styles from "./course.styles";

export function CourseCard({
  course,
  href,
  action,
  priority = false,
}: {
  course: {
    id: string;
    slug: string;
    title: string;
    description: string;
    lessonCount: number;
    demoCount: number;
    thumbnailUrl?: string | null;
  };
  href: string;
  action: string;
  priority?: boolean;
}) {
  const { locale } = useAuth(),
    t = getCourseMessages(locale),
    number = new Intl.NumberFormat(locale);
  return (
    <article
      data-course-card
      className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-solid border-line bg-white transition-shadow hover:shadow-lg"
    >
      <Link href={href} tabIndex={-1} aria-hidden="true" className="block">
        <CourseArtwork
          src={course.thumbnailUrl}
          title={course.title}
          priority={priority}
        />
      </Link>
      <div className="flex flex-1 flex-col gap-4 p-5 sm:p-6">
        <span className={`${styles.badge} self-start`}>{t.free}</span>
        <h2 className="m-0 break-words text-xl font-semibold leading-snug sm:text-2xl">
          <Link href={href} className="hover:underline">
            {course.title}
          </Link>
        </h2>
        <p className="m-0 line-clamp-3 break-words">{course.description}</p>
        <div className="mt-auto flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted">
          <span className="inline-flex items-center gap-2">
            <BookOpen size={16} aria-hidden="true" />
            {number.format(course.lessonCount)} {t.outOf}
          </span>
          {course.demoCount > 0 && (
            <span className="inline-flex items-center gap-2">
              <Play size={16} aria-hidden="true" />
              {number.format(course.demoCount)} {t.demo}
            </span>
          )}
        </div>
        <Link
          href={href}
          className={`${styles.link} justify-between border-x-0 border-b-0 border-t border-solid border-line pt-4`}
        >
          {action}
          <ArrowUpRight size={20} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
