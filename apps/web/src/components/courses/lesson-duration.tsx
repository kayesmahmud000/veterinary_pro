"use client";
import { Clock } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { getCourseMessages } from "@/lib/i18n/courses";
import { formatLessonDuration } from "@/lib/courses/duration";

export function LessonDuration({ seconds }: { seconds?: number | null }) {
  const { locale } = useAuth();
  const t = getCourseMessages(locale);
  if (
    seconds == null ||
    !Number.isSafeInteger(seconds) ||
    seconds <= 0 ||
    seconds > 2147483647
  )
    return null;
  const hours = Math.floor(seconds / 3600),
    minutes = Math.floor(seconds / 60) % 60;
  const parts: Array<[number, "hour" | "minute" | "second"]> = [
    ...(hours ? [[hours, "hour"] as [number, "hour"]] : []),
    ...(minutes ? [[minutes, "minute"] as [number, "minute"]] : []),
    [seconds % 60, "second"],
  ];
  const label = parts
    .map(([value, unit]) =>
      new Intl.NumberFormat(locale, {
        style: "unit",
        unit,
        unitDisplay: "long",
        useGrouping: false,
      }).format(value),
    )
    .join(", ");
  return (
    <span
      data-course-lesson-duration
      className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-muted"
    >
      <Clock size={14} aria-hidden="true" />
      <span data-course-duration-label className="sr-only">
        {t.durationLabel}: {label}
      </span>
      <span data-course-duration-value aria-hidden="true">
        {formatLessonDuration(seconds, locale)}
      </span>
    </span>
  );
}
