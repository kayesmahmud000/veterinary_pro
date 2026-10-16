import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { JwtPayload, UserRole } from "@vetralink/shared-types";
import { AdminConsultationsController } from "./consultations.controller";
import { AdminConsultationsService } from "./consultations.service";
import { TOKEN_SERVICE } from "../auth/services/token.service.interface";
import { CurrentIdentityService } from "../auth/services/current-identity.service";
import { GlobalExceptionFilter } from "../../common/filters/global-exception.filter";
import { WorkflowException } from "../../common/exceptions/domain.exception";
const id = "550e8400-e29b-41d4-a716-446655440001";
const input = {
  action: "AUTO_ASSIGN",
  expectedRevision: "a".repeat(64),
  reason: "Reviewed case",
  actorPassword: "password",
};
describe("Administrative consultation HTTP boundary", () => {
  let app: INestApplication;
  const service = {
    list: jest.fn(async () => ({ items: [], nextCursor: null })),
    detail: jest.fn(async () => ({ id })),
    candidates: jest.fn(async () => ({
      consultationId: id,
      items: [],
      truncated: false,
    })),
    action: jest.fn(async () => ({ id })),
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AdminConsultationsController],
      providers: [
        { provide: AdminConsultationsService, useValue: service },
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
    await request(app.getHttpServer()).get("/admin/consultations").expect(401);
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
        .get("/admin/consultations")
        .auth(role, { type: "bearer" })
        .expect(403);
      await request(app.getHttpServer())
        .post(`/admin/consultations/${id}/actions`)
        .auth(role, { type: "bearer" })
        .send(input)
        .expect(403);
      expect(service.list).not.toHaveBeenCalled();
      expect(service.action).not.toHaveBeenCalled();
    });
  it.each([UserRole.ADMIN, UserRole.SUPER_ADMIN])(
    "accepts %s and parses bounded filters",
    async (role) => {
      await request(app.getHttpServer())
        .get("/admin/consultations?limit=5&status=COMPLETED&search=%20case%20")
        .auth(role, { type: "bearer" })
        .expect(200);
      expect(service.list).toHaveBeenCalledWith(
        expect.objectContaining({ role }),
        { limit: 5, status: "COMPLETED", search: "case" },
      );
      await request(app.getHttpServer())
        .post(`/admin/consultations/${id}/actions`)
        .auth(role, { type: "bearer" })
        .send(input)
        .expect(201);
    },
  );
  it("returns 422 for malformed IDs, unknown queries, action extras and oversized bodies", async () => {
    for (const path of [
      "/admin/consultations/nope",
      "/admin/consultations?limit=101",
      "/admin/consultations?status=UNKNOWN",
      `/admin/consultations/${id}/candidates?search=private`,
      `/admin/consultations/${id}?extra=true`,
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
        .post(`/admin/consultations/${id}/actions`)
        .auth(UserRole.ADMIN, { type: "bearer" })
        .send(body)
        .expect(422);
    expect(service.detail).not.toHaveBeenCalled();
    expect(service.action).not.toHaveBeenCalled();
  });
  it("preserves machine-readable conflict and limiter failures", async () => {
    service.action.mockRejectedValueOnce(
      new WorkflowException("CONSULTATION_VERSION_CONFLICT", "Reload."),
    );
    const conflict = await request(app.getHttpServer())
      .post(`/admin/consultations/${id}/actions`)
      .auth(UserRole.ADMIN, { type: "bearer" })
      .send(input)
      .expect(409);
    expect(JSON.stringify(conflict.body)).toContain(
      "CONSULTATION_VERSION_CONFLICT",
    );
    service.action.mockRejectedValueOnce(
      new WorkflowException("RATE_LIMIT_UNAVAILABLE", "Retry.", 503),
    );
    await request(app.getHttpServer())
      .post(`/admin/consultations/${id}/actions`)
      .auth(UserRole.ADMIN, { type: "bearer" })
      .send(input)
      .expect(503);
  });
});
