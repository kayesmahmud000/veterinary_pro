export type ProjectionDays = 7 | 30;

/** Accept local digits without allowing exponent notation or partial numbers. */
export function parsePlannerNumber(input: string): number | null {
  const normalized = input
    .trim()
    .replace(/[০-৯]/g, (digit) =>
      String(digit.charCodeAt(0) - "০".charCodeAt(0)),
    );
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) && value >= 0 && value <= 10_000 ? value : null;
}

export function projectMilk(
  dailyLiters: number,
  price: number,
  days: ProjectionDays,
) {
  return { liters: dailyLiters * days, value: dailyLiters * days * price };
}
