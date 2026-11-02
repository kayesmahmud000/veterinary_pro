import type { Locale } from "@/lib/i18n/locale";

export function formatLessonDuration(seconds: number, locale: Locale): string {
  const number = new Intl.NumberFormat(locale, { useGrouping: false });
  const padded = new Intl.NumberFormat(locale, {
    useGrouping: false,
    minimumIntegerDigits: 2,
  });
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds / 60) % 60;
  const remaining = seconds % 60;
  return hours
    ? `${number.format(hours)}:${padded.format(minutes)}:${padded.format(remaining)}`
    : `${number.format(minutes)}:${padded.format(remaining)}`;
}
