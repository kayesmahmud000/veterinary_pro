import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight, Info } from "lucide-react";
import { getPublicNavItems } from "@/lib/public-navigation";
import { getLocalization } from "@/lib/i18n/server";
import { FeatureExplorer } from "./interactive-discovery";
import styles from "./marketing.module.css";
export function ProductOverview({
  title,
  intro,
  sections,
  kind,
  children,
}: {
  title: string;
  intro: string;
  sections: readonly { title: string; body: string }[];
  kind: "farm" | "learning" | "veterinary";
  children?: ReactNode;
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
      {children}
      <FeatureExplorer
        sections={sections}
        kind={kind}
        copy={messages.interactive.features}
        locale={locale}
      />
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
