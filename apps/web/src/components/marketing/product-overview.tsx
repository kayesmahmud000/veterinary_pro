import Link from "next/link";
import { ArrowUpRight, Info } from "lucide-react";
import { PUBLIC_NAV_ITEMS } from "@/lib/public-navigation";
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
  return (
    <main id="main-content" className="container">
      <section className={styles.overviewHero}>
        <div className="eyebrow">
          <span className="status-dot" /> THE VETRALINK APPROACH
        </div>
        <h1>{title}</h1>
        <p>{intro}</p>
      </section>
      <section className={styles.overviewGrid} aria-label="Product approach">
        {sections.map((section, i) => (
          <article className={styles.overviewCard} key={section.title}>
            <span>0{i + 1}</span>
            <h2>{section.title}</h2>
            <p>{section.body}</p>
          </article>
        ))}
      </section>
      <aside className={styles.availability}>
        <Info size={20} aria-hidden="true" />
        <p>
          <strong>Explore the vision.</strong> This page introduces the product
          approach. Account access, operational tools, purchases and
          consultation booking are not available on this public website yet.
        </p>
      </aside>
      <nav aria-label="Explore the platform" className={styles.overviewLinks}>
        <Link href="/" className="text-link">
          Back to home <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
        {PUBLIC_NAV_ITEMS.map((item) => (
          <Link href={item.href} className="text-link" key={item.href}>
            {item.label}
            <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        ))}
      </nav>
    </main>
  );
}
