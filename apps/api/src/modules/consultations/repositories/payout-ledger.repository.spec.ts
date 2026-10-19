import { PayoutLedgerRepository } from "./payout-ledger.repository";

describe("Legacy payout summary storage boundary", () => {
  const grouped = (currency = "BDT", status = "PENDING") => ({
    currency,
    status,
    _count: { _all: 2 },
    _sum: { totalFeeCents: 5998, platformFeeCents: 1200, vetPayoutCents: 4798 },
  });
  const make = (rows: any[]) =>
    new PayoutLedgerRepository({
      consultationPayoutLedger: {
        groupBy: async () => rows,
        findMany: async () => {
          throw Error("Unbounded financial rows read");
        },
      },
    } as never);
  it("uses database aggregates for earnings without loading all ledgers", async () => {
    expect(await make([grouped()]).findEarningsSummary("vet")).toEqual({
      vetId: "vet",
      lifetimeGrossCents: 5998,
      lifetimePlatformFeeCents: 1200,
      lifetimeVetEarningsCents: 4798,
      pendingPayoutCents: 4798,
      paidPayoutCents: 0,
      totalSettledConsultations: 2,
      currency: "BDT",
    });
  });
  it("uses database aggregates for platform revenue", async () => {
    expect(
      await make([grouped("BDT", "PAID")]).findPlatformRevenueSummary(),
    ).toMatchObject({
      totalGrossVolumeCents: 5998,
      totalPlatformFeesEarnedCents: 1200,
      totalVetPayoutsPaidCents: 4798,
      totalVetPayoutsOwedCents: 0,
      totalSettledConsultations: 2,
      currency: "BDT",
    });
  });
  it("rejects mixed currencies instead of silently relabeling totals", async () => {
    const repo = make([grouped(), grouped("USD")]);
    await expect(repo.findEarningsSummary("vet")).rejects.toMatchObject({
      errorCode: "SETTLEMENT_MIXED_CURRENCY",
    });
    await expect(repo.findPlatformRevenueSummary()).rejects.toMatchObject({
      errorCode: "SETTLEMENT_MIXED_CURRENCY",
    });
  });
});
