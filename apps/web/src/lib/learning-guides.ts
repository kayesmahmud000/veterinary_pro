import type { Messages } from "./i18n/en";

export const guideDefinitions = [
  { slug: "animal-records", topic: "records" },
  { slug: "daily-milk-log", topic: "milk" },
  { slug: "farm-finances", topic: "finances" },
] as const;

export function findGuide(slug: string) {
  const index = guideDefinitions.findIndex((guide) => guide.slug === slug);
  return index < 0 ? undefined : { ...guideDefinitions[index], index };
}

export function readingMinutes(
  article: Messages["resources"]["articles"][number],
) {
  const text = [
    article.intro,
    article.takeaway,
    ...article.sections.map((section) => `${section.title} ${section.body}`),
  ].join(" ");
  return Math.max(1, Math.ceil(text.trim().split(/\s+/).length / 180));
}
