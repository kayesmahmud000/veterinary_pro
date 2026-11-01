import {
  Beef,
  ClipboardList,
  HeartPulse,
  Sprout,
  Stethoscope,
  Syringe,
  Tractor,
  Wheat,
} from "lucide-react";
import type { publicPagesEn } from "@/lib/i18n/public-pages";
import { BrandLogo } from "@/components/brand/site-brand";

const services = [
  {
    key: "treatment",
    Icon: Stethoscope,
    color: "text-[#85b936]",
    x: 400,
    y: 75,
  },
  {
    key: "breeding",
    Icon: HeartPulse,
    color: "text-[#ed3964]",
    x: 625,
    y: 165,
  },
  { key: "grass", Icon: Sprout, color: "text-[#35b89a]", x: 710, y: 400 },
  {
    key: "vaccination",
    Icon: Syringe,
    color: "text-[#ef7924]",
    x: 625,
    y: 650,
  },
  {
    key: "planning",
    Icon: ClipboardList,
    color: "text-[#2877bd]",
    x: 400,
    y: 735,
  },
  { key: "farm", Icon: Tractor, color: "text-[#a639b2]", x: 175, y: 650 },
  { key: "ration", Icon: Wheat, color: "text-[#2badd7]", x: 90, y: 400 },
  { key: "fattening", Icon: Beef, color: "text-[#f5a32c]", x: 175, y: 165 },
] as const;

type AboutCopy = typeof publicPagesEn.about;

export function AboutServices({ copy }: { copy: AboutCopy }) {
  const t = copy.services;
  return (
    <section
      aria-labelledby="about-services-title"
      className="mb-12 grid items-center gap-8 rounded-3xl bg-white px-4 py-8 md:px-8 min-[1440px]:grid-cols-2 min-[1440px]:gap-12"
    >
      <div className="min-w-0">
        <svg
          viewBox="0 0 800 840"
          aria-hidden="true"
          focusable="false"
          className="mx-auto hidden h-auto w-full max-w-[760px] overflow-visible md:block"
        >
          {services.map(({ key, x, y }) => (
            <line
              key={key}
              x1="400"
              y1="400"
              x2={x}
              y2={y}
              strokeDasharray="3 6"
              strokeWidth="2.5"
              className="stroke-[#b5bcb4]"
            />
          ))}
          <circle cx="400" cy="400" r="162" className="fill-white" />
          <circle
            cx="400"
            cy="400"
            r="149"
            strokeWidth="2"
            className="fill-[#f3f8f2] stroke-line"
          />
          <path
            d="M 244 370 A 160 160 0 0 1 370 244 M 430 244 A 160 160 0 0 1 556 370 M 556 430 A 160 160 0 0 1 430 556 M 370 556 A 160 160 0 0 1 244 430"
            fill="none"
            strokeWidth="3"
            strokeLinecap="round"
            className="stroke-[#8b9e88]"
          />
          <path
            d="m 360 236 15 7 -11 12 M 563 360 l -7 15 -12 -11 M 440 564 l -15 -7 11 -12 M 237 440 l 7 -15 12 11"
            className="fill-[#8b9e88]"
          />
          <foreignObject x="290" y="290" width="220" height="220">
            <BrandLogo className="h-full w-full" sizes="220px" />
          </foreignObject>
          {services.map(({ key, Icon, color, x, y }) => (
            <g key={key} className={color}>
              <circle
                cx={x}
                cy={y}
                r="65"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeDasharray="350 59"
                transform={`rotate(-35 ${x} ${y})`}
              />
              <circle
                cx={x}
                cy={y}
                r="58"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              />
              <circle cx={x} cy={y} r="52" className="fill-current" />
              <Icon
                x={x - 28}
                y={y - 28}
                width="56"
                height="56"
                strokeWidth="1.7"
                className="text-white"
              />
              <text
                x={x}
                y={y + 90}
                textAnchor="middle"
                className="fill-ink text-[18px] font-medium"
              >
                {t.items[key].split("\n").map((line, index) => (
                  <tspan key={line} x={x} dy={index === 0 ? 0 : 25}>
                    {line}
                  </tspan>
                ))}
              </text>
            </g>
          ))}
        </svg>
        <div aria-hidden="true" className="mb-6 flex justify-center md:hidden">
          <BrandLogo className="h-24 w-24" sizes="96px" />
        </div>
        <ul className="m-0 grid list-none grid-cols-2 gap-x-3 gap-y-6 p-0 md:sr-only">
          {services.map(({ key, Icon, color }) => (
            <li
              key={key}
              className="flex flex-col items-center gap-3 text-center"
            >
              <span
                aria-hidden="true"
                className={`flex h-16 w-16 items-center justify-center rounded-full border-2 border-solid border-current ${color}`}
              >
                <Icon size={32} strokeWidth={1.7} />
              </span>
              <span className="text-sm font-medium leading-6 text-ink">
                {t.items[key].replace("\n", " ")}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="min-w-0 min-[1440px]:self-start min-[1440px]:pt-16">
        <h2 id="about-services-title" className="!text-3xl">
          {t.title}
        </h2>
        <p>{copy.intro}</p>
        <p className="mb-0">{t.description}</p>
      </div>
    </section>
  );
}
