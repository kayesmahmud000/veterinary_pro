import { cn } from "@/lib/ui/cn";
import siteStyles from "@/lib/ui/site.styles";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  ClipboardList,
  Milk,
  Wallet,
} from "lucide-react";
import type { Messages } from "@/lib/i18n/en";
import { formatNumber, type Locale } from "@/lib/i18n/locale";
import { guideDefinitions, readingMinutes } from "@/lib/learning-guides";
import ui from "./showcase.styles";

export function ResourceCatalog({
  copy,
  locale,
  topic,
  embedded = false,
}: {
  copy: Messages["resources"];
  locale: Locale;
  topic?: string;
  embedded?: boolean;
}) {
  const activeTopic = guideDefinitions.some((guide) => guide.topic === topic)
    ? topic
    : undefined;
  const guides = guideDefinitions
    .map((guide, i) => ({ ...guide, index: i }))
    .filter((guide) => !activeTopic || guide.topic === activeTopic);
  const icons = [ClipboardList, Milk, Wallet];
  return (
    <section className={cn(ui.resources)} id="guides">
      <div className={cn(ui.sectionHeading)}>
        <div>
          <div className={cn(siteStyles["eyebrow"])}>{copy.eyebrow}</div>
          <h2>{copy.title}</h2>
        </div>
        <p>{copy.body}</p>
      </div>
      {!embedded && (
        <>
          <nav className={cn(ui.topicFilters)} aria-label={copy.filter}>
            <Link
              href="/learning#guides"
              aria-current={!activeTopic ? "true" : undefined}
            >
              {copy.all}
            </Link>
            {guideDefinitions.map((guide, i) => (
              <Link
                key={guide.topic}
                href={`/learning?topic=${guide.topic}#guides`}
                aria-current={activeTopic === guide.topic ? "true" : undefined}
              >
                {copy.topics[i]}
              </Link>
            ))}
          </nav>
          <p className={cn(ui.catalogCount)}>
            {formatNumber(guides.length, locale)} {copy.count}
          </p>
        </>
      )}
      <div className={cn(ui.resourceGrid)}>
        {guides.map((guide) => {
          const article = copy.articles[guide.index];
          const Icon = icons[guide.index];
          return (
            <Link
              key={guide.slug}
              href={`/learning/${guide.slug}`}
              className={cn(ui.resourceCard)}
            >
              <div className={cn(ui.resourceArt, [ui.art0, ui.art1, ui.art2][guide.index])}>
                <Icon size={52} strokeWidth={1.25} aria-hidden="true" />
                <span>{copy.topics[guide.index]}</span>
              </div>
              <div className={cn(ui.resourceContent)}>
                <div className={cn(ui.resourceMeta)}>
                  <span>{copy.format}</span>
                  <span>
                    {formatNumber(readingMinutes(article), locale)} {copy.time}
                  </span>
                </div>
                <h3>{article.title}</h3>
                <p>{article.description}</p>
                <span className={cn(ui.resourceAction)}>
                  {copy.read}
                  <ArrowUpRight size={18} aria-hidden="true" />
                </span>
              </div>
            </Link>
          );
        })}
      </div>
      {embedded ? (
        <Link className={cn(siteStyles["text-link"], ui.catalogMore)} href="/learning#guides">
          <BookOpen size={18} aria-hidden="true" />
          {copy.browse}
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
      ) : (
        <p className={cn(ui.catalogNote)}>{copy.available}</p>
      )}
    </section>
  );
}
