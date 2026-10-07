import { cn } from "@/lib/ui/cn";
import ui from "./showcase.styles";

export function AnimalMark({ species = 0 }: { species?: number }) {
  return (
    <svg viewBox="0 0 100 100" fill="none" aria-hidden="true">
      {species === 3 ? (
        <>
          <path
            d="M39 28c-9-15 0-21 7-11 1-17 13-16 13-2 13-8 19 2 8 12"
            fill="#bd7052"
          />
          <path
            d="M40 29c27-9 41 13 31 33L59 87H30l-9-29c-4-14 4-27 19-29Z"
            fill="#f6ecd0"
            stroke="currentColor"
            strokeWidth="3"
          />
          <path
            d="m74 43 17 9-18 6"
            fill="#e4b25b"
            stroke="currentColor"
            strokeWidth="3"
          />
          <circle cx="60" cy="43" r="3" fill="currentColor" />
          <path
            d="M44 63c8 2 10 9 4 15"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </>
      ) : (
        <>
          <path
            d={
              species === 2
                ? "M35 31C5 38 6 6 19 10M65 31c30 7 29-25 16-21"
                : species === 1
                  ? "M38 30 28 5M62 30 72 5"
                  : "M35 28 24 12M65 28 76 12"
            }
            stroke="currentColor"
            strokeWidth={species === 2 ? 6 : 4}
            strokeLinecap="round"
          />
          <path
            d="M29 36C4 23 8 49 29 47m42-11c25-13 21 13 0 11"
            fill="#ccd8bb"
            stroke="currentColor"
            strokeWidth="3"
          />
          <path
            d="M30 33c9-12 31-12 40 0l-5 38c-2 18-28 18-30 0Z"
            fill={species === 2 ? "#8e9f89" : "#f6ecd0"}
            stroke="currentColor"
            strokeWidth="3"
          />
          {species === 0 && (
            <path d="M32 34c12-10 17 0 10 19l-11-2" fill="#608264" />
          )}
          {species === 1 && <path d="m43 80 7 14 7-14" fill="#608264" />}
          <ellipse cx="50" cy="71" rx="16" ry="10" fill="#d4b7a0" />
          <path
            d="M41 70h1m16 0h1"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <circle cx="39" cy="51" r="2.5" fill="currentColor" />
          <circle cx="61" cy="51" r="2.5" fill="currentColor" />
        </>
      )}
    </svg>
  );
}

export function ServiceArtwork({ kind }: { kind: number }) {
  return (
    <div className={cn(ui.serviceArt, [ui.art0, ui.art1, ui.art2][kind])}>
      <svg viewBox="0 0 320 160" fill="none" aria-hidden="true">
        <ellipse cx="160" cy="145" rx="128" ry="12" fill="#264b3510" />
        {kind === 0 ? (
          <>
            <path
              d="M0 135C50 60 125 150 185 96s105-15 135 0v64H0Z"
              fill="#ced9bf"
            />
            <rect
              x="68"
              y="13"
              width="195"
              height="125"
              rx="9"
              fill="#fffdf7"
              stroke="#81947b"
            />
            <path d="M68 39h195" stroke="#d5decd" />
            <circle cx="81" cy="26" r="3" fill="#a9b89a" />
            <path
              d="M94 60h61m-61 10h40"
              stroke="#a3b295"
              strokeWidth="5"
              strokeLinecap="round"
            />
            <path
              d="m88 113 29-15 30 5 29-21 31 8 35-29"
              stroke="#426a4b"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <rect
              x="35"
              y="76"
              width="60"
              height="72"
              rx="10"
              fill="#e8eddf"
              stroke="#81947b"
            />
            <path
              d="M48 94h33m-33 12h21m-21 26h33"
              stroke="#7a9370"
              strokeWidth="4"
              strokeLinecap="round"
            />
          </>
        ) : kind === 1 ? (
          <>
            <circle cx="231" cy="51" r="35" fill="#e5c984" />
            <path
              d="M69 32c27-7 57 0 83 17v87c-26-17-56-24-83-17Zm83 17c26-17 56-24 83-17v87c-27-7-57 0-83 17Z"
              fill="#fffdf7"
              stroke="#a58e5c"
              strokeWidth="2"
            />
            <path
              d="M89 57c15 0 27 3 43 10m-43 9c15 0 27 3 43 10m-43 9c15 0 27 3 43 10m40-38c15-7 27-10 43-10m-43 29c15-7 27-10 43-10m-43 29c15-7 27-10 43-10"
              stroke="#c4b38b"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <rect x="221" y="83" width="45" height="59" rx="7" fill="#52765a" />
            <path
              d="m234 110 6 6 13-17"
              stroke="#fff"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        ) : (
          <>
            <circle cx="90" cy="71" r="50" fill="#cbdacb" />
            <rect
              x="105"
              y="23"
              width="128"
              height="118"
              rx="10"
              fill="#fffdf7"
              stroke="#82988c"
            />
            <rect x="140" y="14" width="58" height="19" rx="6" fill="#527967" />
            <path
              d="M125 54h29m-29 10h52m-52 48h86m-86 12h57"
              stroke="#b4c5b6"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <path
              d="M128 88h19l8-13 13 25 12-20 8 8h24"
              stroke="#527967"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="243" cy="108" r="25" fill="#e6c982" />
            <path
              d="M243 97v22m-11-11h22"
              stroke="#527967"
              strokeWidth="4"
              strokeLinecap="round"
            />
          </>
        )}
      </svg>
    </div>
  );
}
