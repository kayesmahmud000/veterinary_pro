"use client";

import { cn } from "@/lib/ui/cn";
import siteStyles from "@/lib/ui/site.styles";
import { useId, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check } from "lucide-react";
import type { Messages } from "@/lib/i18n/en";
import { AnimalMark } from "./product-visuals";
import ui from "./showcase.styles";

export function SpeciesExplorer({
  copy,
}: {
  copy: Messages["showcase"]["species"];
}) {
  const [selected, setSelected] = useState(0);
  const id = useId();
  const animal = copy.items[selected];
  return (
    <section className={cn(siteStyles["container"], ui.speciesSection)}>
      <div className={cn(ui.sectionHeading)}>
        <div>
          <div className={cn(siteStyles["eyebrow"])}>{copy.eyebrow}</div>
          <h2>{copy.title}</h2>
        </div>
        <p>{copy.body}</p>
      </div>
      <div className={cn(ui.speciesGrid)}>
        <div className={cn(ui.speciesChoices)} role="group" aria-label={copy.label}>
          {copy.items.map((item, i) => (
            <button
              type="button"
              key={item.name}
              aria-pressed={selected === i}
              aria-controls={id}
              onClick={() => setSelected(i)}
            >
              <AnimalMark species={i} />
              <span>{item.name}</span>
              {selected === i && <Check size={16} aria-hidden="true" />}
            </button>
          ))}
        </div>
        <article id={id} className={cn(ui.speciesDetail)}>
          <span className={cn(ui.sampleBadge)}>{copy.planned}</span>
          <h3 aria-live="polite">{animal.title}</h3>
          <p>{animal.body}</p>
          <ul>
            {animal.records.map((record) => (
              <li key={record}>
                <Check size={17} aria-hidden="true" />
                {record}
              </li>
            ))}
          </ul>
          <Link className={cn(siteStyles["text-link"])} href="/farm-management">
            {copy.action}
            <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
        </article>
      </div>
    </section>
  );
}
