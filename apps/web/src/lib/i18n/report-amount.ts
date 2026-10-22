import type { Locale } from "./locale";

function formats(locale: string) {
  return {
    major: new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
    fraction: new Intl.NumberFormat(locale, {
      useGrouping: false,
      minimumIntegerDigits: 2,
      maximumFractionDigits: 0,
    }),
    integer: new Intl.NumberFormat(locale),
  };
}
const localized = { bn: formats("bn-BD"), en: formats("en-GB") };
// The report contract supplies no denomination metadata for other stored codes.
const twoDigitCurrencies = new Set(["USD", "BDT"]);

export function formatReportAmount(
  totalMinor: string,
  currency: string,
  locale: Locale,
): string {
  if (!/^\d{1,30}$/.test(totalMinor) || !/^[A-Z]{3}$/.test(currency)) {
    throw new RangeError("Invalid report amount");
  }
  const f = localized[locale];
  if (!twoDigitCurrencies.has(currency)) {
    const unit = locale === "bn" ? "ক্ষুদ্র এককে" : "minor units";
    return `${currency} ${f.integer.format(BigInt(totalMinor))} (${unit})`;
  }
  const padded = totalMinor.padStart(3, "0");
  const fraction = f.fraction.format(BigInt(padded.slice(-2)));
  // Intl receives only the exact whole BigInt; replace its zero fraction with
  // the separately localized exact remainder. No amount passes through Number.
  const amount = f.major
    .formatToParts(BigInt(padded.slice(0, -2)))
    .map((part) => (part.type === "fraction" ? fraction : part.value))
    .join("");
  return `${currency} ${amount}`;
}
