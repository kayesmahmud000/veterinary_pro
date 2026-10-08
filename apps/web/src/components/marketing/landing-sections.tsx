import { cn } from "@/lib/ui/cn";
import siteStyles from "@/lib/ui/site.styles";
import Link from "next/link";
import {
  ArrowUpRight,
  Sprout,
  BookOpen,
  HeartPulse,
  MoveUpRight,
} from "lucide-react";
import { getLocalization } from "@/lib/i18n/server";
import { formatNumber } from "@/lib/i18n/locale";
import styles from "./marketing.styles";
import {
  InteractiveHero,
  WorkflowExplorer,
  SearchableFaq,
} from "./interactive-discovery";
import { FarmDemo } from "./farm-demo";
import { ServiceArtwork } from "./product-visuals";
import { SpeciesExplorer } from "./species-explorer";
import { ResourceCatalog } from "./resource-catalog";
import showcase from "./showcase.styles";

const pillarPresentation = [
  { icon: Sprout, href: "/farm-management", className: styles.farmCard },
  { icon: BookOpen, href: "/learning", className: styles.learnCard },
  { icon: HeartPulse, href: "/veterinary-care", className: styles.vetCard },
];

export function LandingSections() {
  const { locale, messages } = getLocalization();
  const content = messages.landing;
  const number = (value: number) =>
    formatNumber(value, locale, { minimumIntegerDigits: 2 });

  return (
    <>
      <InteractiveHero
        content={{ hero: content.hero }}
        copy={messages.interactive.hero}
        locale={locale}
      />
      <section className={cn(styles.pillars)}>
        <div className={cn(siteStyles["container"])}>
          <div className={cn(styles.sectionHeading)}>
            <div>
              <div className={cn(siteStyles["eyebrow"])}>{content.pillars.eyebrow}</div>
              <h2>{content.pillars.title}</h2>
            </div>
            <p>{content.pillars.body}</p>
          </div>
          <div className={cn(styles.pillarGrid)}>
            {pillarPresentation.map(({ icon: Icon, href, className }, i) => {
              const pillar = content.pillars.items[i];
              return (
                <Link
                  className={cn(styles.pillarCard, className, showcase.visualCard)}
                  href={href}
                  key={href}
                >
                  <ServiceArtwork kind={i} />
                  <div className={cn(showcase.visualCardContent)}>
                    <div className={cn(styles.cardTop)}>
                      <Icon size={28} aria-hidden="true" />
                      <span>{number(i + 1)}</span>
                    </div>
                    <div className={cn(showcase.serviceCaption)}>
                      {messages.showcase.cards[i]}
                    </div>
                    <h3>{pillar.title}</h3>
                    <p>{pillar.body}</p>
                    <div className={cn(styles.cardLink)}>
                      {pillar.action}
                      <ArrowUpRight size={20} aria-hidden="true" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
      <SpeciesExplorer copy={messages.showcase.species} />
      <FarmDemo copy={messages.interactive.demo} locale={locale} brandName={messages.brand.name} />
      <WorkflowExplorer
        content={content.workflow}
        copy={messages.interactive.workflow}
        locale={locale}
      />
      <div className={cn(siteStyles["container"])}>
        <ResourceCatalog copy={messages.resources} locale={locale} embedded />
      </div>
      <section className={cn(siteStyles["container"])}>
        <div className={cn(styles.editorialGrid)}>
          <article className={cn(styles.editorial)}>
            <BookOpen size={30} aria-hidden="true" />
            <div className={cn(siteStyles["eyebrow"])}>{content.learning.eyebrow}</div>
            <h2>{content.learning.title}</h2>
            <p>{content.learning.body}</p>
            <Link className={cn(siteStyles["text-link"])} href="/learning">
              {messages.actions.learning}{" "}
              <MoveUpRight size={18} aria-hidden="true" />
            </Link>
          </article>
          <article className={cn(styles.editorial, styles.editorialCare)}>
            <HeartPulse size={30} aria-hidden="true" />
            <div className={cn(siteStyles["eyebrow"])}>{content.veterinary.eyebrow}</div>
            <h2>{content.veterinary.title}</h2>
            <p>{content.veterinary.body}</p>
            <Link className={cn(siteStyles["text-link"])} href="/veterinary-care">
              {messages.actions.veterinary}{" "}
              <MoveUpRight size={18} aria-hidden="true" />
            </Link>
          </article>
        </div>
      </section>
      <SearchableFaq
        content={content.faq}
        copy={messages.interactive.faq}
        locale={locale}
      />
      <section className={cn(siteStyles["container"], styles.finalSection)}>
        <div className={cn(styles.finalCta)}>
          <div className={cn(siteStyles["eyebrow"])}>{content.final.eyebrow}</div>
          <h2>{content.final.title}</h2>
          <p>{content.final.body}</p>
          <Link className={cn(siteStyles["button"], siteStyles["button-light"])} href="/farm-management">
            {messages.actions.farm}{" "}
            <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </>
  );
}
