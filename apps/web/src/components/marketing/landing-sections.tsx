import Link from "next/link";
import {
  ArrowUpRight,
  ArrowRight,
  Sprout,
  BookOpen,
  HeartPulse,
  Leaf,
  Check,
  MoveUpRight,
} from "lucide-react";
import { getLocalization } from "@/lib/i18n/server";
import { formatNumber } from "@/lib/i18n/locale";
import styles from "./marketing.module.css";

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
      <section className={styles.hero}>
        <div className={`container ${styles.heroGrid}`}>
          <div className={styles.heroCopy}>
            <div className="eyebrow">
              <span className="status-dot" /> {content.hero.eyebrow}
            </div>
            <h1>
              {content.hero.title} <span>{content.hero.care}</span>
            </h1>
            <p>{content.hero.body}</p>
            <div className="actions">
              <Link className="button" href="/farm-management">
                {messages.actions.farmTools}{" "}
                <ArrowUpRight size={18} aria-hidden="true" />
              </Link>
              <Link className="text-link" href="/learning">
                {messages.actions.learning}{" "}
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
            </div>
            <div className={styles.heroNote}>
              <Leaf size={16} aria-hidden="true" /> {content.hero.note}
            </div>
          </div>
          <div
            className={styles.visual}
            role="img"
            aria-label={content.visual.description}
          >
            <div className={styles.visualTop}>
              <span>{content.visual.title}</span>
              <span>
                {content.visual.fieldNotes} / {number(1)}
              </span>
            </div>
            <div className={styles.sun} />
            <div className={styles.fieldBack} />
            <div className={styles.fieldFront} />
            <div className={styles.furrows} />
            <div className={styles.barn}>
              <div className={styles.roof} />
              <div className={styles.barnDoor} />
              <div className={styles.barnWindow} />
            </div>
            <div className={styles.tree}>
              <span />
              <i />
            </div>
            <div className={` ${styles.noteCard} ${styles.animalNote}`}>
              <span className={styles.noteIcon}>
                <Sprout size={19} aria-hidden="true" />
              </span>
              <div>
                <strong>{content.visual.animalTitle}</strong>
                <small>{content.visual.animalBody}</small>
              </div>
            </div>
            <div className={`${styles.noteCard} ${styles.careNote}`}>
              <span className={styles.noteIcon}>
                <HeartPulse size={19} aria-hidden="true" />
              </span>
              <div>
                <strong>{content.visual.careTitle}</strong>
                <small>{content.visual.careBody}</small>
              </div>
              <span className={styles.check}>
                <Check size={14} aria-hidden="true" />
              </span>
            </div>
            <div className={styles.visualBottom}>
              <span>
                <span className="status-dot" /> {content.visual.everyday}
              </span>
              <span>{content.visual.preview}</span>
            </div>
          </div>
        </div>
      </section>
      <section className={styles.pillars}>
        <div className="container">
          <div className={styles.sectionHeading}>
            <div>
              <div className="eyebrow">{content.pillars.eyebrow}</div>
              <h2>{content.pillars.title}</h2>
            </div>
            <p>{content.pillars.body}</p>
          </div>
          <div className={styles.pillarGrid}>
            {pillarPresentation.map(({ icon: Icon, href, className }, i) => {
              const pillar = content.pillars.items[i];
              return (
                <Link
                  className={`${styles.pillarCard} ${className}`}
                  href={href}
                  key={href}
                >
                  <div className={styles.cardTop}>
                    <Icon size={28} aria-hidden="true" />
                    <span>{number(i + 1)}</span>
                  </div>
                  <h3>{pillar.title}</h3>
                  <p>{pillar.body}</p>
                  <div className={styles.cardLink}>
                    {pillar.action}
                    <ArrowUpRight size={20} aria-hidden="true" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
      <section className={styles.workflow}>
        <div className={`container ${styles.workflowGrid}`}>
          <div>
            <div className="eyebrow">{content.workflow.eyebrow}</div>
            <h2>
              {content.workflow.title}
              <br />
              <span>{content.workflow.connections}</span>
            </h2>
            <p>{content.workflow.body}</p>
            <Link className="text-link" href="/farm-management">
              {content.workflow.action}{" "}
              <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
          </div>
          <ol className={styles.steps}>
            {content.workflow.steps.map(({ title, body }, i) => (
              <li key={title}>
                <span>{number(i + 1)}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <section className="container">
        <div className={styles.editorialGrid}>
          <article className={styles.editorial}>
            <BookOpen size={30} aria-hidden="true" />
            <div className="eyebrow">{content.learning.eyebrow}</div>
            <h2>{content.learning.title}</h2>
            <p>{content.learning.body}</p>
            <Link className="text-link" href="/learning">
              {messages.actions.learning}{" "}
              <MoveUpRight size={18} aria-hidden="true" />
            </Link>
          </article>
          <article className={`${styles.editorial} ${styles.editorialCare}`}>
            <HeartPulse size={30} aria-hidden="true" />
            <div className="eyebrow">{content.veterinary.eyebrow}</div>
            <h2>{content.veterinary.title}</h2>
            <p>{content.veterinary.body}</p>
            <Link className="text-link" href="/veterinary-care">
              {messages.actions.veterinary}{" "}
              <MoveUpRight size={18} aria-hidden="true" />
            </Link>
          </article>
        </div>
      </section>
      <section className={`container ${styles.faq}`}>
        <div>
          <div className="eyebrow">{content.faq.eyebrow}</div>
          <h2>{content.faq.title}</h2>
        </div>
        <div>
          {content.faq.items.map(({ question, answer }) => (
            <details key={question}>
              <summary>
                {question}
                <span aria-hidden="true">+</span>
              </summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>
      <section className={`container ${styles.finalSection}`}>
        <div className={styles.finalCta}>
          <div className="eyebrow">{content.final.eyebrow}</div>
          <h2>{content.final.title}</h2>
          <p>{content.final.body}</p>
          <Link className="button button-light" href="/farm-management">
            {messages.actions.farm}{" "}
            <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </>
  );
}
