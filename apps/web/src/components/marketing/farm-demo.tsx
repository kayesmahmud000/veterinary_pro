"use client";

import { useId, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Check,
  Milk,
  RotateCcw,
  Sprout,
  Wallet,
} from "lucide-react";
import type { Messages } from "@/lib/i18n/en";
import { formatNumber, type Locale } from "@/lib/i18n/locale";
import {
  parsePlannerNumber,
  projectMilk,
  type ProjectionDays,
} from "@/lib/milk-projection";
import ui from "./interactive.module.css";

const icons = [Sprout, Milk, Wallet];

export function FarmDemo({
  copy,
  locale,
}: {
  copy: Messages["interactive"]["demo"];
  locale: Locale;
}) {
  const [view, setView] = useState(0);
  const [animal, setAnimal] = useState(0);
  const [quantity, setQuantity] = useState("18");
  const [price, setPrice] = useState("60");
  const [days, setDays] = useState<ProjectionDays>(7);
  const id = useId();
  const daily = parsePlannerNumber(quantity);
  const rate = parsePlannerNumber(price);
  const projection =
    daily !== null && rate !== null ? projectMilk(daily, rate, days) : null;
  const number = (value: number) =>
    formatNumber(value, locale, { maximumFractionDigits: 2 });
  const money = (value: number) =>
    formatNumber(value, locale, {
      style: "currency",
      currency: "BDT",
      maximumFractionDigits: 2,
    });
  const selectedAnimal = copy.animals[animal];
  const expenseAmounts = [450, 70, 30].map((value) => value * days);
  const expenses = expenseAmounts.reduce((sum, value) => sum + value, 0);
  const spans = days === 7 ? [1, 1, 1, 1, 1, 1, 1] : [7, 7, 7, 9];

  function reset() {
    setQuantity("18");
    setPrice("60");
    setDays(7);
    setAnimal(0);
  }

  return (
    <section
      id="farm-demo"
      className={ui.demoSection}
      aria-labelledby={`${id}-title`}
    >
      <div className="container">
        <div className={ui.demoHeading}>
          <div>
            <div className="eyebrow">{copy.eyebrow}</div>
            <h2 id={`${id}-title`}>{copy.title}</h2>
          </div>
          <p>{copy.body}</p>
        </div>
        <div className={ui.workspace}>
          <div className={ui.workspaceTop}>
            <div>
              <span className={ui.demoMark}>
                <Sprout size={22} aria-hidden="true" />
              </span>
              <div>
                <strong>Vetralink Pro</strong>
                <span>{copy.sample}</span>
              </div>
            </div>
            <span className={ui.badge}>{copy.badge}</span>
          </div>
          <div className={ui.workspaceToolbar}>
            <div
              className={ui.demoTabs}
              role="group"
              aria-label={copy.tabsLabel}
            >
              {copy.tabs.map((label, index) => {
                const Icon = icons[index];
                return (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={view === index}
                    aria-controls={`${id}-panel`}
                    onClick={() => setView(index)}
                  >
                    <Icon size={17} aria-hidden="true" />
                    {label}
                  </button>
                );
              })}
            </div>
            <button type="button" className={ui.reset} onClick={reset}>
              <RotateCcw size={15} aria-hidden="true" />
              <span>{copy.reset}</span>
            </button>
          </div>
          <div id={`${id}-panel`} className={ui.demoPanel}>
            {view === 0 && (
              <div className={ui.animalView}>
                <div>
                  <h3>{copy.animalLabel}</h3>
                  <div
                    className={ui.animalChoices}
                    role="group"
                    aria-label={copy.animalLabel}
                  >
                    {copy.animals.map((item, index) => (
                      <button
                        key={item.name}
                        type="button"
                        aria-pressed={animal === index}
                        aria-controls={`${id}-animal`}
                        onClick={() => setAnimal(index)}
                      >
                        <span className={ui.animalAvatar}>
                          <Sprout size={26} aria-hidden="true" />
                        </span>
                        <span>
                          <strong>{item.name}</strong>
                          <small>{item.species}</small>
                        </span>
                        {animal === index && (
                          <Check size={18} aria-hidden="true" />
                        )}
                      </button>
                    ))}
                  </div>
                  <p className={ui.helper}>{copy.localNote}</p>
                </div>
                <article className={ui.animalProfile} id={`${id}-animal`}>
                  <span className={ui.badge}>{selectedAnimal.detail}</span>
                  <h3>{selectedAnimal.name}</h3>
                  <p>{copy.profileTitle}</p>
                  <dl className={ui.profileData}>
                    <div>
                      <dt>{copy.tag}</dt>
                      <dd>VL-00{animal + 1}</dd>
                    </div>
                    <div>
                      <dt>{copy.species}</dt>
                      <dd>{selectedAnimal.species}</dd>
                    </div>
                    <div>
                      <dt>{copy.dailyMilk}</dt>
                      <dd>
                        {number(animal === 0 ? 18 : 12)} {copy.liters}
                      </dd>
                    </div>
                  </dl>
                  <h4>{copy.recordList}</h4>
                  <ul className={ui.checkList}>
                    {copy.records.map((label) => (
                      <li key={label}>
                        <Check size={16} aria-hidden="true" />
                        {label}
                      </li>
                    ))}
                  </ul>
                </article>
              </div>
            )}
            {view === 1 && (
              <div className={ui.milkView}>
                <div>
                  <h3>{copy.milkTitle}</h3>
                  <p>{copy.milkBody}</p>
                  <div className={ui.plannerFields}>
                    <div>
                      <label
                        className={ui.inputLabel}
                        htmlFor={`${id}-quantity`}
                      >
                        {copy.quantity}
                      </label>
                      <input
                        id={`${id}-quantity`}
                        inputMode="decimal"
                        type="text"
                        maxLength={18}
                        value={quantity}
                        onChange={(event) => setQuantity(event.target.value)}
                        aria-invalid={daily === null}
                        aria-describedby={
                          daily === null ? `${id}-quantity-error` : undefined
                        }
                      />
                      {daily === null && (
                        <p
                          id={`${id}-quantity-error`}
                          className={ui.fieldError}
                        >
                          {copy.invalidQuantity}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className={ui.inputLabel} htmlFor={`${id}-price`}>
                        {copy.price}
                      </label>
                      <input
                        id={`${id}-price`}
                        inputMode="decimal"
                        type="text"
                        maxLength={18}
                        value={price}
                        onChange={(event) => setPrice(event.target.value)}
                        aria-invalid={rate === null}
                        aria-describedby={
                          rate === null ? `${id}-price-error` : undefined
                        }
                      />
                      {rate === null && (
                        <p id={`${id}-price-error`} className={ui.fieldError}>
                          {copy.invalidPrice}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className={ui.inputLabel}>{copy.period}</div>
                  <div
                    className={ui.periodChoices}
                    role="group"
                    aria-label={copy.period}
                  >
                    {([7, 30] as const).map((value) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={days === value}
                        onClick={() => setDays(value)}
                      >
                        {number(value)} {copy.days}
                      </button>
                    ))}
                  </div>
                  <p className={ui.helper}>{copy.assumption}</p>
                </div>
                <div className={ui.projection}>
                  <div role="status">
                    {projection ? (
                      <dl className={ui.metrics}>
                        <div>
                          <dt>
                            {copy.total} · {number(days)} {copy.days}
                          </dt>
                          <dd>
                            {number(projection.liters)}{" "}
                            <small>{copy.liters}</small>
                          </dd>
                        </div>
                        <div>
                          <dt>{copy.value}</dt>
                          <dd>{money(projection.value)}</dd>
                        </div>
                      </dl>
                    ) : (
                      <p className={ui.fieldError}>{copy.invalidResult}</p>
                    )}
                  </div>
                  {projection && (
                    <figure
                      className={ui.chart}
                      aria-label={`${copy.chart}: ${number(projection.liters)} ${copy.liters}, ${number(days)} ${copy.days}`}
                    >
                      <figcaption>
                        {copy.chart}
                        <span>{copy.chartUnit}</span>
                      </figcaption>
                      <div className={ui.bars} aria-hidden="true">
                        {spans.map((span, index) => (
                          <div className={ui.barColumn} key={index}>
                            <span>{number((daily ?? 0) * span)}</span>
                            <div
                              className={ui.bar}
                              style={{
                                height: `${daily === 0 ? 0 : (span / Math.max(...spans)) * 90}px`,
                              }}
                            />
                            <small>
                              {days === 7
                                ? `${copy.day} ${number(index + 1)}`
                                : `${number(index * 7 + 1)}–${number(index === 3 ? 30 : (index + 1) * 7)}`}
                            </small>
                          </div>
                        ))}
                      </div>
                    </figure>
                  )}
                </div>
              </div>
            )}
            {view === 2 && (
              <div>
                <div className={ui.financeHeading}>
                  <div>
                    <h3>{copy.financeTitle}</h3>
                    <p>{copy.financeBody}</p>
                  </div>
                  <button
                    type="button"
                    className={ui.inlineButton}
                    onClick={() => setView(1)}
                  >
                    {copy.edit}
                    <ArrowUpRight size={16} aria-hidden="true" />
                  </button>
                </div>
                {projection ? (
                  <>
                    <dl className={ui.financeMetrics}>
                      <div>
                        <dt>
                          {copy.income} · {number(days)} {copy.days}
                        </dt>
                        <dd>{money(projection.value)}</dd>
                      </div>
                      <div>
                        <dt>{copy.cost}</dt>
                        <dd>{money(expenses)}</dd>
                      </div>
                      <div>
                        <dt>{copy.balance}</dt>
                        <dd>{money(projection.value - expenses)}</dd>
                      </div>
                    </dl>
                    <dl className={ui.expenseList}>
                      {copy.expenses.map((label, index) => (
                        <div key={label}>
                          <dt>{label}</dt>
                          <dd>{money(expenseAmounts[index])}</dd>
                        </div>
                      ))}
                    </dl>
                    <p className={ui.helper}>{copy.financeNote}</p>
                  </>
                ) : (
                  <p className={ui.fieldError} role="status">
                    {copy.invalidResult}
                  </p>
                )}
              </div>
            )}
          </div>
          <div className={ui.workspaceFoot}>
            <p>
              <span className="status-dot" />
              {copy.localNote}
            </p>
            <Link className="text-link" href="/farm-management">
              {copy.explore}
              <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
