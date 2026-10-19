import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { JwtPayload, UserRole } from "@vetralink/shared-types";
import { AdminSettlementsController } from "./settlements.controller";
import { AdminSettlementsService } from "./settlements.service";
import { TOKEN_SERVICE } from "../auth/services/token.service.interface";
import { CurrentIdentityService } from "../auth/services/current-identity.service";
import { GlobalExceptionFilter } from "../../common/filters/global-exception.filter";
import { WorkflowException } from "../../common/exceptions/domain.exception";
import { ConsultationSettlementController } from "../consultations/controllers/consultation-settlement.controller";
import { VET_PAYOUT_LEDGER_SERVICE } from "../consultations/services/vet-payout-ledger.service.interface";
import { CONSULTATION_REPOSITORY } from "../consultations/repositories/consultation.repository.interface";
const id = "550e8400-e29b-41d4-a716-446655440001";
const input = {
  payoutReference: "EXT-123",
  expectedRevision: "a".repeat(64),
  reason: "Reviewed case",
  actorPassword: "password",
};
describe("Administrative settlement HTTP boundary", () => {
  let app: INestApplication;
  const service = {
    list: jest.fn(async () => ({ items: [], nextCursor: null })),
    detail: jest.fn(async () => ({ id })),
    summary: jest.fn(async () => ({ items: [] })),
    preview: jest.fn(async () => ({ id })),
    bulk: jest.fn(async () => ({ items: [] })),
    reconcile: jest.fn(async () => ({ id })),
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [
        AdminSettlementsController,
        ConsultationSettlementController,
      ],
      providers: [
        {
          provide: VET_PAYOUT_LEDGER_SERVICE,
          useValue: {
            processPayout: async () => ({ id }),
            bulkProcessPayouts: async () => ({
              processedCount: 1,
              totalPaidCents: 100,
            }),
          },
        },
        {
          provide: CONSULTATION_REPOSITORY,
          useValue: { findById: async () => null },
        },
        { provide: AdminSettlementsService, useValue: service },
        {
          provide: TOKEN_SERVICE,
          useValue: {
            verifyAccessToken: async (role: string) =>
              ({ sub: id, role, authorizationVersion: 0 }) as JwtPayload,
          },
        },
        {
          provide: CurrentIdentityService,
          useValue: { resolve: async (claims: JwtPayload) => claims },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();
  });
  afterAll(async () => app?.close());
  beforeEach(() => jest.clearAllMocks());
  it("denies missing identity", async () => {
    await request(app.getHttpServer()).get("/admin/settlements").expect(401);
    expect(service.list).not.toHaveBeenCalled();
  });
  for (const role of [
    UserRole.LEARNER,
    UserRole.FARMER,
    UserRole.BUYER,
    UserRole.VET,
  ])
    it(`denies ${role} reads and writes`, async () => {
      await request(app.getHttpServer())
        .get("/admin/settlements")
        .auth(role, { type: "bearer" })
        .expect(403);
      await request(app.getHttpServer())
        .post(`/admin/settlements/${id}/reconcile`)
        .auth(role, { type: "bearer" })
        .send(input)
        .expect(403);
      expect(service.list).not.toHaveBeenCalled();
      expect(service.reconcile).not.toHaveBeenCalled();
    });
  it.each([UserRole.ADMIN, UserRole.SUPER_ADMIN])(
    "accepts %s and parses bounded filters",
    async (role) => {
      await request(app.getHttpServer())
        .get("/admin/settlements?limit=5&status=PENDING&search=%20case%20")
        .auth(role, { type: "bearer" })
        .expect(200);
      expect(service.list).toHaveBeenCalledWith(
        expect.objectContaining({ role }),
        { limit: 5, status: "PENDING", search: "case" },
      );
      await request(app.getHttpServer())
        .post(`/admin/settlements/${id}/reconcile`)
        .auth(role, { type: "bearer" })
        .send(input)
        .expect(201);
    },
  );
  it("returns 422 for malformed IDs, unknown queries, action extras and oversized bodies", async () => {
    for (const path of [
      "/admin/settlements/nope",
      "/admin/settlements?limit=101",
      "/admin/settlements?status=UNKNOWN",
      `/admin/settlements/${id}/preview?search=private`,
      `/admin/settlements/${id}?extra=true`,
    ]) {
      await request(app.getHttpServer())
        .get(path)
        .auth(UserRole.ADMIN, { type: "bearer" })
        .expect(422);
    }
    for (const body of [
      { ...input, vetId: id },
      { ...input, reason: "x".repeat(17000) },
    ])
      await request(app.getHttpServer())
        .post(`/admin/settlements/${id}/reconcile`)
        .auth(UserRole.ADMIN, { type: "bearer" })
        .send(body)
        .expect(422);
    expect(service.detail).not.toHaveBeenCalled();
    expect(service.reconcile).not.toHaveBeenCalled();
  });
  it("preserves machine-readable conflict and limiter failures", async () => {
    service.reconcile.mockRejectedValueOnce(
      new WorkflowException("SETTLEMENT_VERSION_CONFLICT", "Reload."),
    );
    const conflict = await request(app.getHttpServer())
      .post(`/admin/settlements/${id}/reconcile`)
      .auth(UserRole.ADMIN, { type: "bearer" })
      .send(input)
      .expect(409);
    expect(JSON.stringify(conflict.body)).toContain(
      "SETTLEMENT_VERSION_CONFLICT",
    );
    service.reconcile.mockRejectedValueOnce(
      new WorkflowException("RATE_LIMIT_UNAVAILABLE", "Retry.", 503),
    );
    await request(app.getHttpServer())
      .post(`/admin/settlements/${id}/reconcile`)
      .auth(UserRole.ADMIN, { type: "bearer" })
      .send(input)
      .expect(503);
  });
  it("requires strict bounded legacy process bodies and valid IDs", async () => {
    for (const body of [
      {},
      { payoutReference: "x" },
      { payoutReference: "EXT-123", unknown: true },
    ]) {
      await request(app.getHttpServer())
        .post(`/consultations/settlements/${id}/process`)
        .auth(UserRole.ADMIN, { type: "bearer" })
        .send(body)
        .expect(422);
    }
    await request(app.getHttpServer())
      .post("/consultations/settlements/bulk-process")
      .auth(UserRole.ADMIN, { type: "bearer" })
      .send({
        vetId: id,
        payoutIds: [id, id.toUpperCase()],
        payoutReference: "EXT-123",
      })
      .expect(422);
  });
  it("supports summary, immutable preview and bounded bulk only at their exact methods", async () => {
    await request(app.getHttpServer())
      .get("/admin/settlements/summary?currency=BDT")
      .auth(UserRole.ADMIN, { type: "bearer" })
      .expect(200);
    await request(app.getHttpServer())
      .get(`/admin/settlements/${id}/preview`)
      .auth(UserRole.SUPER_ADMIN, { type: "bearer" })
      .expect(200);
    await request(app.getHttpServer())
      .post("/admin/settlements/bulk-reconcile")
      .auth(UserRole.ADMIN, { type: "bearer" })
      .send({
        ...input,
        expectedRevision: undefined,
        items: [{ id, expectedRevision: input.expectedRevision }],
        vetId: id,
        currency: "BDT",
      })
      .expect(201);
    await request(app.getHttpServer())
      .put(`/admin/settlements/${id}/reconcile`)
      .auth(UserRole.ADMIN, { type: "bearer" })
      .send(input)
      .expect(404);
  });
});
