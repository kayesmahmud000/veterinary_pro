import { PayoutStatus } from "@vetralink/shared-types";
import { PayoutLedgerEntity } from "../entities/payout-ledger.entity";
import { VetPayoutLedgerService } from "./vet-payout-ledger.service";

describe("Legacy payout financial safety", () => {
  const make = (status = PayoutStatus.PENDING, currency = "BDT") => {
    const ledger = PayoutLedgerEntity.fromPersistence({
      ...PayoutLedgerEntity.create({
        id: "ledger",
        consultationId: "consultation",
        vetId: "vet",
        totalFeeCents: 2999,
        currency,
      }).toDto(),
      status,
      createdAt: new Date(),
      updatedAt: new Date(),
      processedAt: null,
    });
    const tx = { transaction: "synthetic" };
    const repo: any = {
      findById: jest.fn(async () => ledger),
      save: jest.fn(async (e) => e),
      lockForProcessing: jest.fn(),
      lockProcessingActor: jest.fn(async () => true),
      findConsultationForSettlement: jest.fn(async () => ({
        id: "consultation",
        vetId: "vet",
        status: "COMPLETED",
        paymentStatus: "CAPTURED",
        feeCents: 2999,
        currency,
      })),
    };
    const audit: any = { record: jest.fn() };
    const transactions: any = { run: jest.fn(async (fn) => fn(tx)) };
    const service = new (VetPayoutLedgerService as any)(
      repo,
      {},
      audit,
      transactions,
    ) as VetPayoutLedgerService;
    return { service, repo, audit, transactions, tx, ledger };
  };
  it("shares one transaction across locked payout persistence and its audit", async () => {
    const { service, repo, audit, tx } = make();
    expect(
      (
        await service.processPayout(
          "ledger",
          { payoutReference: "EXT-123" },
          "admin",
        )
      ).status,
    ).toBe("PAID");
    expect(repo.lockForProcessing).toHaveBeenCalledWith(["ledger"], tx);
    expect(repo.save).toHaveBeenCalledWith(expect.any(PayoutLedgerEntity), tx);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ entityId: "ledger" }),
      tx,
    );
  });
  it.each([PayoutStatus.HELD, PayoutStatus.REVERSED, PayoutStatus.PAID])(
    "rejects %s without another write or audit",
    async (status) => {
      const { service, repo, audit } = make(status);
      await expect(
        service.processPayout(
          "ledger",
          { payoutReference: "EXT-123" },
          "admin",
        ),
      ).rejects.toMatchObject({ errorCode: "SETTLEMENT_ACTION_UNAVAILABLE" });
      expect(repo.save).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    },
  );
  it("rejects a changed consultation snapshot", async () => {
    const { service, repo } = make();
    repo.findConsultationForSettlement.mockResolvedValue({
      status: "COMPLETED",
      paymentStatus: "CAPTURED",
      vetId: "vet",
      feeCents: 9999,
      currency: "BDT",
    });
    await expect(
      service.processPayout("ledger", { payoutReference: "EXT-123" }, "admin"),
    ).rejects.toMatchObject({ errorCode: "SETTLEMENT_ACTION_UNAVAILABLE" });
    expect(repo.save).not.toHaveBeenCalled();
  });
  it("validates every bulk item before any mutation", async () => {
    const { service, repo, audit } = make();
    repo.findById
      .mockResolvedValueOnce(
        PayoutLedgerEntity.create({
          id: "first",
          consultationId: "consultation",
          vetId: "vet",
          totalFeeCents: 2999,
          currency: "BDT",
        }),
      )
      .mockResolvedValueOnce(null);
    await expect(
      service.bulkProcessPayouts(
        "vet",
        ["first", "missing"],
        { payoutReference: "EXT-123" },
        "admin",
      ),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(repo.save).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });
  it("requires a real external reference", async () => {
    const { service, repo } = make();
    await expect(
      service.processPayout("ledger", {}, "admin"),
    ).rejects.toMatchObject({ statusCode: 422 });
    expect(repo.save).not.toHaveBeenCalled();
  });
  it("rejects a mixed-currency bulk before writes", async () => {
    const { service, repo } = make();
    repo.findById
      .mockResolvedValueOnce(
        PayoutLedgerEntity.create({
          id: "first",
          consultationId: "consultation",
          vetId: "vet",
          totalFeeCents: 2999,
          currency: "BDT",
        }),
      )
      .mockResolvedValueOnce(
        PayoutLedgerEntity.create({
          id: "second",
          consultationId: "consultation2",
          vetId: "vet",
          totalFeeCents: 2999,
          currency: "USD",
        }),
      );
    repo.findConsultationForSettlement.mockImplementation(
      async (id: string) => ({
        id,
        vetId: "vet",
        status: "COMPLETED",
        paymentStatus: "CAPTURED",
        feeCents: 2999,
        currency: id === "consultation2" ? "USD" : "BDT",
      }),
    );
    await expect(
      service.bulkProcessPayouts(
        "vet",
        ["first", "second"],
        { payoutReference: "EXT-123" },
        "admin",
      ),
    ).rejects.toMatchObject({ errorCode: "SETTLEMENT_ACTION_UNAVAILABLE" });
    expect(repo.save).not.toHaveBeenCalled();
  });
});
