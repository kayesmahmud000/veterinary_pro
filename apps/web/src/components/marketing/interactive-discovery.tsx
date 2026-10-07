"use client";

import { cn } from "@/lib/ui/cn";
import siteStyles from "@/lib/ui/site.styles";
import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  HeartPulse,
  Pause,
  Play,
  Search,
  Sprout,
} from "lucide-react";
import type { Messages } from "@/lib/i18n/en";
import { formatNumber, type Locale } from "@/lib/i18n/locale";
import styles from "./marketing.styles";
import ui from "./interactive.styles";

const destinations = ["/farm-management", "/learning", "/veterinary-care"];
const icons = [Sprout, BookOpen, HeartPulse];
const heroPhotos = [
  "/images/hero/cow-field.jpg",
  "/images/hero/goats.jpg",
  "/images/hero/cow-care.jpg",
];

export function InteractiveHero({
  content,
  copy,
  locale,
}: {
  content: Pick<Messages["landing"], "hero">;
  copy: Messages["interactive"]["hero"];
  locale: Locale;
}) {
  const [selected, setSelected] = useState(0);
  const [autoplay, setAutoplay] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(true);
  const [pageVisible, setPageVisible] = useState(true);
  const banner = useRef<HTMLElement>(null);
  const id = useId();
  const goal = copy.goals[selected];
  const rotating = autoplay && !hovered && !focused && visible && pageVisible;

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    setAutoplay(!motion.matches);
    const stopForReducedMotion = () => {
      if (motion.matches) setAutoplay(false);
    };
    const updateVisibility = () => setPageVisible(!document.hidden);
    updateVisibility();
    motion.addEventListener("change", stopForReducedMotion);
    document.addEventListener("visibilitychange", updateVisibility);
    const observer = new IntersectionObserver(
      ([entry]) =>
        setVisible(entry.isIntersecting && entry.intersectionRatio >= 0.15),
      { threshold: 0.15 },
    );
    if (banner.current) observer.observe(banner.current);
    return () => {
      motion.removeEventListener("change", stopForReducedMotion);
      document.removeEventListener("visibilitychange", updateVisibility);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!rotating) return;
    const timer = window.setTimeout(
      () => setSelected((current) => (current + 1) % copy.goals.length),
      4000,
    );
    return () => window.clearTimeout(timer);
  }, [rotating, selected, copy.goals.length]);

  return (
    <section
      ref={banner}
      className={cn(ui.heroBanner)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setFocused(false);
      }}
    >
      <div className={cn(ui.heroPhotos)}>
        {copy.goals.map((slide, index) => (
          <div
            className={cn(ui.heroPhoto)}
            key={slide.label}
            aria-hidden={selected !== index}
          >
            <Image
              src={heroPhotos[index]}
              alt={slide.imageAlt}
              fill
              priority={index === 0}
              sizes="100vw"
              className={cn(ui.heroPhotoImage)}
            />
          </div>
        ))}
      </div>
      <div className={cn(ui.heroShade)} aria-hidden="true" />
      <div className={cn(siteStyles["container"], ui.heroContainer)}>
        <div className={cn(ui.heroContent)}>
          <div className={cn(siteStyles["eyebrow"])}>
            <span className={cn(ui.heroStatusDot)} />
            {content.hero.eyebrow}
          </div>
          <h1>{content.hero.title}</h1>
          <p
            className={cn(ui.heroSubhead)}
            id={id}
            aria-live={rotating ? "off" : "polite"}
          >
            {goal.previewTitle}
          </p>
          <div className={cn(ui.heroActions)}>
            <div
              className={cn(ui.photoChoices)}
              role="group"
              aria-label={copy.label}
            >
              {copy.goals.map((item, index) => {
                const GoalIcon = icons[index];
                return (
                  <button
                    key={item.label}
                    type="button"
                    aria-current={selected === index}
                    aria-controls={id}
                    onClick={() => setSelected(index)}
                  >
                    <GoalIcon size={17} aria-hidden="true" />
                    {item.label}
                  </button>
                );
              })}
            </div>
            <div className={cn(siteStyles["actions"])}>
              <Link
                className={cn(siteStyles["button"], ui.heroPrimaryAction)}
                href={destinations[selected]}
              >
                {goal.action}
                <ArrowUpRight size={18} aria-hidden="true" />
              </Link>
              <Link
                className={cn(siteStyles["button"], ui.heroSecondaryAction)}
                href="#farm-demo"
              >
                {copy.demo}
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
        <div
          className={cn(ui.heroCarousel)}
          role="region"
          aria-roledescription={copy.carousel}
          aria-label={copy.carouselLabel}
        >
          <button
            className={cn(ui.carouselArrow)}
            type="button"
            aria-label={copy.previousSlide}
            onClick={() =>
              setSelected(
                (current) =>
                  (current - 1 + copy.goals.length) % copy.goals.length,
              )
            }
          >
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <div className={cn(ui.heroCarouselControls)}>
            <button
              className={cn(ui.carouselPlayback)}
              type="button"
              aria-label={autoplay ? copy.pauseSlideshow : copy.playSlideshow}
              title={autoplay ? copy.pauseSlideshow : copy.playSlideshow}
              onClick={() => {
                setAutoplay((current) => !current);
                setFocused(false);
              }}
            >
              {autoplay ? (
                <Pause size={18} aria-hidden="true" />
              ) : (
                <Play size={18} aria-hidden="true" />
              )}
            </button>
            <div
              className={cn(ui.carouselPagination)}
              role="group"
              aria-label={copy.slideNavigation}
            >
              {copy.goals.map((slide, index) => (
                <button
                  className={cn(ui.heroThumbnail)}
                  key={slide.label}
                  type="button"
                  aria-label={`${copy.goToSlide} ${formatNumber(index + 1, locale)}: ${slide.label}`}
                  aria-current={selected === index}
                  onClick={() => setSelected(index)}
                >
                  <Image src={heroPhotos[index]} alt="" fill sizes="92px" />
                  <span>{slide.label}</span>
                </button>
              ))}
            </div>
            <span
              className={cn(ui.carouselCount)}
              aria-live={rotating ? "off" : "polite"}
            >
              {formatNumber(selected + 1, locale)} /{" "}
              {formatNumber(copy.goals.length, locale)}
            </span>
          </div>
          <button
            className={cn(ui.carouselArrow)}
            type="button"
            aria-label={copy.nextSlide}
            onClick={() =>
              setSelected((current) => (current + 1) % copy.goals.length)
            }
          >
            <ChevronRight size={20} aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
}

export function WorkflowExplorer({
  content,
  copy,
  locale,
}: {
  content: Messages["landing"]["workflow"];
  copy: Messages["interactive"]["workflow"];
  locale: Locale;
}) {
  const [selected, setSelected] = useState(0);
  const id = useId();
  return (
    <section className={cn(styles.workflow)}>
      <div className={cn(siteStyles["container"], styles.workflowGrid)}>
        <div>
          <div className={cn(siteStyles["eyebrow"])}>{content.eyebrow}</div>
          <h2>
            {content.title}
            <br />
            <span>{content.connections}</span>
          </h2>
          <p>{content.body}</p>
          <Link className={cn(siteStyles["text-link"])} href="/farm-management">
            {content.action}
            <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
          <div className={cn(ui.recordPreview)} id={id}>
            <span className={cn(ui.badge)}>{copy.sample}</span>
            <h3>{copy.recordTitles[selected]}</h3>
            <dl>
              {copy.recordLabels[selected].map((label, i) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{copy.recordValues[selected][i]}</dd>
                </div>
              ))}
            </dl>
            <p>{copy.note}</p>
          </div>
        </div>
        <div>
          <p className={cn(ui.helper)}>{copy.hint}</p>
          <ol className={cn(ui.workflowSteps)} aria-label={copy.label}>
            {content.steps.map((step, i) => (
              <li key={step.title}>
                <button
                  type="button"
                  aria-pressed={selected === i}
                  aria-controls={id}
                  onClick={() => setSelected(i)}
                >
                  <span className={cn(ui.stepNumber)}>
                    {formatNumber(i + 1, locale, { minimumIntegerDigits: 2 })}
                  </span>
                  <span>
                    <strong>{step.title}</strong>
                    <span className={cn(ui.stepBody)}>{step.body}</span>
                  </span>
                  <ArrowUpRight size={18} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

export function SearchableFaq({
  content,
  copy,
  locale,
}: {
  content: Messages["landing"]["faq"];
  copy: Messages["interactive"]["faq"];
  locale: Locale;
}) {
  const [query, setQuery] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const items = [
    ...content.items,
    { question: copy.demoQuestion, answer: copy.demoAnswer },
  ];
  const normalized = query.trim().normalize("NFC").toLocaleLowerCase();
  const filtered = items.filter((item) =>
    `${item.question} ${item.answer}`
      .normalize("NFC")
      .toLocaleLowerCase()
      .includes(normalized),
  );
  return (
    <section className={cn(siteStyles["container"], styles.faq)}>
      <div>
        <div className={cn(siteStyles["eyebrow"])}>{content.eyebrow}</div>
        <h2>{content.title}</h2>
        <label className={cn(ui.inputLabel)} htmlFor={id}>
          {copy.search}
        </label>
        <div className={cn(ui.searchField)}>
          <Search size={18} aria-hidden="true" />
          <input
            ref={input}
            id={id}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={copy.placeholder}
          />
        </div>
        <p className={cn(ui.helper)} role="status">
          {formatNumber(filtered.length, locale)} {copy.results}
        </p>
        {query && (
          <button
            type="button"
            className={cn(ui.inlineButton)}
            onClick={() => {
              setQuery("");
              input.current?.focus();
            }}
          >
            {copy.clear}
          </button>
        )}
      </div>
      <div>
        {filtered.length ? (
          filtered.map((item) => (
            <details key={item.question}>
              <summary>
                {item.question}
                <span aria-hidden="true">+</span>
              </summary>
              <p>{item.answer}</p>
            </details>
          ))
        ) : (
          <p className={cn(ui.emptyState)}>{copy.empty}</p>
        )}
      </div>
    </section>
  );
}

export function FeatureExplorer({
  sections,
  kind,
  copy,
  locale,
}: {
  sections: readonly { title: string; body: string }[];
  kind: "farm" | "learning" | "veterinary";
  copy: Messages["interactive"]["features"];
  locale: Locale;
}) {
  const [selected, setSelected] = useState(0);
  const id = useId();
  const Icon = icons[kind === "farm" ? 0 : kind === "learning" ? 1 : 2];
  return (
    <section className={cn(ui.featureExplorer)} aria-label={copy.label}>
      <div>
        <p className={cn(ui.helper)}>{copy.hint}</p>
        <div className={cn(ui.featureChoices)} role="group" aria-label={copy.label}>
          {sections.map((section, index) => (
            <button
              key={section.title}
              type="button"
              aria-pressed={selected === index}
              aria-controls={id}
              onClick={() => setSelected(index)}
            >
              <span>
                {formatNumber(index + 1, locale, { minimumIntegerDigits: 2 })}
              </span>
              <strong>{section.title}</strong>
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          ))}
        </div>
      </div>
      <article id={id} className={cn(ui.featureDetail)}>
        <div className={cn(ui.featureDetailTop)}>
          <span className={cn(ui.badge)}>{copy.detail}</span>
          <Icon size={30} aria-hidden="true" />
        </div>
        <h2>{sections[selected].title}</h2>
        <p>{sections[selected].body}</p>
        <ul className={cn(ui.checkList)}>
          {copy.highlights[kind][selected].map((item) => (
            <li key={item}>
              <Check size={17} aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
        {kind === "farm" && (
          <Link className={cn(siteStyles["text-link"])} href="/#farm-demo">
            {copy.demo}
            <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
        )}
      </article>
    </section>
  );
}
