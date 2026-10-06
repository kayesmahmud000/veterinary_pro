import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Download } from "lucide-react";
import { getLocalization } from "@/lib/i18n/server";
import { formatNumber } from "@/lib/i18n/locale";
import { guideDefinitions, readingMinutes } from "@/lib/learning-guides";
import ui from "@/components/marketing/showcase.module.css";

type GuideIndex = 0 | 1 | 2;

export function getGuideMetadata(index: GuideIndex): Metadata {
  const { messages } = getLocalization();
  const article = messages.resources.articles[index];
  return { title: article.title, description: article.description };
}

export function GuideArticle({ index }: { index: GuideIndex }) {
  const guide = guideDefinitions[index];
  const { messages, locale } = getLocalization();
  const copy = messages.resources;
  const article = copy.articles[index];
  return (
    <main id="main-content" className="container">
      <article className={ui.article}>
        <Link
          className="text-link"
          href={`/learning?topic=${guide.topic}#guides`}
        >
          <ArrowLeft size={18} aria-hidden="true" />
          {copy.back}
        </Link>
        <div className={ui.articleMeta}>
          <span>{copy.format}</span>
          <span>{copy.topics[index]}</span>
          <span>
            {formatNumber(readingMinutes(article), locale)} {copy.time}
          </span>
        </div>
        <h1>{article.title}</h1>
        <p className={ui.articleIntro}>{article.intro}</p>
        {article.sections.map((section) => (
          <section key={section.title}>
            <h2>{section.title}</h2>
            <p>{section.body}</p>
          </section>
        ))}
        <p className={ui.takeaway}>{article.takeaway}</p>
        {article.headers.length > 0 && (
          <div className={ui.downloadBox}>
            <a
              className="button"
              href={`/learning/${guide.slug}/template`}
              download
            >
              <Download size={18} aria-hidden="true" />
              {copy.template}
            </a>
            <p>{copy.templateNote}</p>
          </div>
        )}
        <nav className={ui.relatedGuides} aria-label={copy.related}>
          <h2>{copy.related}</h2>
          {guideDefinitions
            .map((item, index) => ({ ...item, index }))
            .filter((item) => item.slug !== guide.slug)
            .map((item) => (
              <Link key={item.slug} href={`/learning/${item.slug}`}>
                {copy.articles[item.index].title}
                <ArrowUpRight size={18} aria-hidden="true" />
              </Link>
            ))}
        </nav>
      </article>
    </main>
  );
}
