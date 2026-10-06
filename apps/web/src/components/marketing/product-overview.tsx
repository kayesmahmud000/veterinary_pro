import Link from "next/link";
import { ArrowUpRight, Info } from "lucide-react";
import { getPublicNavItems } from "@/lib/public-navigation";
import { getLocalization } from "@/lib/i18n/server";
import { formatNumber } from "@/lib/i18n/locale";
import styles from "./marketing.module.css";
export function ProductOverview({
  title,
  intro,
  sections,
}: {
  title: string;
  intro: string;
  sections: readonly { title: string; body: string }[];
}) {
  const { locale, messages } = getLocalization();
  const items = getPublicNavItems(messages);
  return (
    <main id="main-content" className="container">
      <section className={styles.overviewHero}>
        <div className="eyebrow">
          <span className="status-dot" /> {messages.overview.eyebrow}
        </div>
        <h1>{title}</h1>
        <p>{intro}</p>
      </section>
      <section
        className={styles.overviewGrid}
        aria-label={messages.overview.sections}
      >
        {sections.map((section, i) => (
          <article className={styles.overviewCard} key={section.title}>
            <span>
              {formatNumber(i + 1, locale, { minimumIntegerDigits: 2 })}
            </span>
            <h2>{section.title}</h2>
            <p>{section.body}</p>
          </article>
        ))}
      </section>
      <aside className={styles.availability}>
        <Info size={20} aria-hidden="true" />
        <p>
          <strong>{messages.overview.availabilityTitle}</strong>{" "}
          {messages.overview.availabilityBody}
        </p>
      </aside>
      <nav
        aria-label={messages.overview.explore}
        className={styles.overviewLinks}
      >
        <Link href="/" className="text-link">
          {messages.actions.home} <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
        {items.map((item) => (
          <Link href={item.href} className="text-link" key={item.href}>
            {item.label}
            <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        ))}
      </nav>
    </main>
  );
}
