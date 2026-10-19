import { VetPayoutLedgerService } from "../consultations/services/vet-payout-ledger.service";
import { PayoutLedgerEntity } from "../consultations/entities/payout-ledger.entity";
describe("Settlement financial contracts", () => {
  const service = new VetPayoutLedgerService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  it.each([NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid minor units %s",
    (amount) => {
      expect(() => service.calculateSplit(amount)).toThrow();
      expect(() =>
        PayoutLedgerEntity.create({
          consultationId: "c",
          vetId: "v",
          totalFeeCents: amount,
        }),
      ).toThrow();
    },
  );
  it.each([NaN, Infinity])("rejects nonfinite rate %s", (rate) => {
    expect(() => service.calculateSplit(100, rate)).toThrow();
  });
});

import { AdminSettlementsService } from "./settlements.service";
import { UserRole } from "@vetralink/shared-types";
describe("Administrative settlement identity", () => {
  const claims: any = {
    sub: "actor",
    role: UserRole.ADMIN,
    authorizationVersion: 3,
  };
  function service(user: any) {
    return new AdminSettlementsService(
      { list: async () => ({ items: [], nextCursor: null }) } as never,
      { findById: async () => user } as never,
      {} as never,
      { run: async (fn: any) => fn({}) } as never,
      {} as never,
      {} as never,
    );
  }
  const actor = {
    id: "actor",
    role: UserRole.ADMIN,
    authorizationVersion: 3,
    isActive: () => true,
  };
  it("rejects missing authorization version", async () => {
    await expect(
      service(actor).list(
        { ...claims, authorizationVersion: undefined },
        { limit: 20 },
      ),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
  it("rejects a role change even if version was not advanced", async () => {
    await expect(
      service({ ...actor, role: UserRole.SUPER_ADMIN }).list(claims, {
        limit: 20,
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});

import {
  adminSettlementBulkSchema,
  adminSettlementQuerySchema,
  adminSettlementSummaryQuerySchema,
  adminSettlementReconcileSchema,
} from "@vetralink/shared-types";
describe("Settlement shared request contracts", () => {
  const id = "550e8400-e29b-41d4-a716-446655440001";
  const input = {
    items: [{ id, expectedRevision: "a".repeat(64) }],
    vetId: id,
    currency: "BDT",
    actorPassword: "secret",
    reason: "Reconciled externally",
    payoutReference: "REF-123",
  };
  it("rejects duplicate UUIDs even when casing differs", () => {
    expect(
      adminSettlementBulkSchema.safeParse({
        ...input,
        items: [input.items[0], { ...input.items[0], id: id.toUpperCase() }],
      }).success,
    ).toBe(false);
  });
  it("bounds pages, filters, confirmations and unique batch sizes", () => {
    expect(
      adminSettlementQuerySchema.parse({ limit: "5", search: " vet " }),
    ).toEqual({ limit: 5, search: "vet" });
    for (const query of [
      { limit: 101 },
      { limit: 0 },
      { currency: "bdt" },
      { extra: true },
      { status: "UNKNOWN" },
    ])
      expect(adminSettlementQuerySchema.safeParse(query).success).toBe(false);
    expect(
      adminSettlementSummaryQuerySchema.safeParse({ limit: 20 }).success,
    ).toBe(false);
    expect(
      adminSettlementReconcileSchema.safeParse({
        ...input,
        expectedRevision: "A".repeat(64),
      }).success,
    ).toBe(false);
    expect(
      adminSettlementBulkSchema.safeParse({ ...input, items: [] }).success,
    ).toBe(false);
    expect(
      adminSettlementBulkSchema.safeParse({
        ...input,
        items: Array(21).fill(input.items[0]),
      }).success,
    ).toBe(false);
  });
});

describe("Settlement transaction conflicts", () => {
  it.each([
    { code: "P2034" },
    { code: "P2010", meta: { code: "40P01" } },
    { code: "P2010", meta: { code: "40001" } },
  ])("maps transaction conflicts to a reload response: %j", async (error) => {
    const actor: any = {
      id: "actor",
      role: UserRole.ADMIN,
      authorizationVersion: 0,
      passwordHash: "hash",
      isActive: () => true,
    };
    const service = new AdminSettlementsService(
      {} as never,
      { findById: async () => actor } as never,
      { compare: async () => true } as never,
      {
        run: async () => {
          throw error;
        },
      } as never,
      {} as never,
      { hit: async () => {} } as never,
    );
    await expect(
      service.reconcile(
        { sub: "actor", role: UserRole.ADMIN, authorizationVersion: 0 } as any,
        "id",
        {
          expectedRevision: "a".repeat(64),
          reason: "Checked reference",
          actorPassword: "secret",
          payoutReference: "EXT-123",
        },
      ),
    ).rejects.toMatchObject({
      errorCode: "SETTLEMENT_VERSION_CONFLICT",
      statusCode: 409,
    });
  });
});
