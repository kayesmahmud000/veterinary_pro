import { animalListSchema } from "./farm-contracts";
export type FarmOverviewCard<T> = {
  state: "loading" | "ready" | "empty" | "denied" | "error";
  data?: T;
  code?: string;
};
export function projectAnimalCount(value: unknown) {
  return animalListSchema.parse(value).meta.total;
}
export function projectMilkYield(value: {
  summary: { totalRecords: number; totalYieldLiters: number };
}): FarmOverviewCard<number> {
  return value.summary.totalRecords === 0
    ? { state: "empty" }
    : { state: "ready", data: value.summary.totalYieldLiters };
}
// Current API aggregations use UTC business-day buckets. Keep the local date
// separate, so early-morning Dhaka users never request a future UTC bucket.
export function getReportingPeriod(now: Date = new Date()) {
  const localDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const reportDate = now.toISOString().slice(0, 10);
  return { localDate, reportDate, monthStart: reportDate.slice(0, 8) + "01" };
}

export type AnimalFormValues = {
  tagNumber: string;
  name: string;
  rfidNumber: string;
  species: string;
  breed: string;
  gender: string;
  dateOfBirth: string;
  weightKg: string;
  status: string;
};
export function buildAnimalWritePayload(
  values: AnimalFormValues,
  baseline?: AnimalFormValues,
) {
  const payload: Record<string, unknown> = {};
  for (const key of Object.keys(values) as (keyof AnimalFormValues)[]) {
    const convert = (value: string) =>
      key === "weightKg"
        ? value.trim()
          ? Number(value)
          : null
        : value.trim() || null;
    const value = convert(values[key]);
    if (baseline && value === convert(baseline[key])) continue;
    if (!baseline && value === null) continue;
    payload[key] = value;
  }
  return payload;
}
