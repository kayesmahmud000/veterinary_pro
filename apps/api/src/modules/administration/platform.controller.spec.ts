import { Test } from "@nestjs/testing";
import { INestApplication, ExecutionContext } from "@nestjs/common";
import request from "supertest";
import { JwtAuthGuard, RolesGuard } from "../../common/guards";
import { GlobalExceptionFilter } from "../../common/filters/global-exception.filter";
import { UnauthorizedDomainException } from "../../common/exceptions/domain.exception";
import { PlatformController } from "./platform.controller";
import { PlatformService } from "./platform.service";
const id = "d8000000-0000-4000-8000-000000000301";
const query = "from=2026-01-01&to=2026-02-01&timezone=UTC";
const confirmation = {
  actorPassword: "synthetic",
  reason: "Reviewed synthetic export",
  confirmed: true,
};
describe("ADM8 actual Nest transport with controlled authentication and use cases", () => {
  let app: INestApplication;
  const service = Object.fromEntries(
    [
      "settings",
      "saveSettings",
      "integrations",
      "system",
      "diagnostics",
      "report",
      "exportReport",
      "exportAudit",
    ].map((k) => [k, jest.fn().mockResolvedValue({})]),
  );
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [PlatformController],
      providers: [{ provide: PlatformService, useValue: service }, RolesGuard],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate(ctx: ExecutionContext) {
          const req = ctx.switchToHttp().getRequest(),
            role = req.headers["x-test-role"];
          if (!role) throw new UnauthorizedDomainException();
          req.user = { sub: id, role, authorizationVersion: 0 };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useLogger(false);
    await app.init();
  });
  afterAll(() => app?.close());
  beforeEach(() => jest.clearAllMocks());
  it("denies anonymous and ordinary roles and limits ADMIN to reports/exports", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/admin/platform/settings")
      .expect(401);
    for (const role of ["ADMIN", "LEARNER", "FARMER", "BUYER", "VET"])
      for (const path of ["settings", "integrations", "system"])
        await request(app.getHttpServer())
          .get(`/api/v1/admin/platform/${path}`)
          .set("X-Test-Role", role)
          .expect(403);
    for (const role of ["LEARNER", "FARMER", "BUYER", "VET"])
      await request(app.getHttpServer())
        .get(`/api/v1/admin/platform/reports?${query}`)
        .set("X-Test-Role", role)
        .expect(403);
    expect(service.settings).not.toHaveBeenCalled();
    expect(service.report).not.toHaveBeenCalled();
  });
  it("allows both admin roles to read exact report ranges, and only Super reads configuration", async () => {
    for (const role of ["ADMIN", "SUPER_ADMIN"])
      await request(app.getHttpServer())
        .get(`/api/v1/admin/platform/reports?${query}`)
        .set("X-Test-Role", role)
        .expect(200);
    await request(app.getHttpServer())
      .get("/api/v1/admin/platform/settings")
      .set("X-Test-Role", "SUPER_ADMIN")
      .expect(200);
    expect(service.report).toHaveBeenCalledWith(
      expect.objectContaining({ role: "ADMIN" }),
      { from: "2026-01-01", to: "2026-02-01", timezone: "UTC" },
    );
  });
  it("rejects invalid/missing/repeated query fields before delegation", async () => {
    for (const suffix of [
      "",
      `?${query}&secret=1`,
      `?${query}&timezone=UTC`,
      "?from=2026-02-30&to=2026-03-01&timezone=UTC",
    ])
      await request(app.getHttpServer())
        .get("/api/v1/admin/platform/reports" + suffix)
        .set("X-Test-Role", "ADMIN")
        .expect(422);
    expect(service.report).not.toHaveBeenCalled();
  });
  it("rejects unknown operations, unconfirmed actions and oversized audit exports", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/admin/platform/diagnostics")
      .set("X-Test-Role", "ADMIN")
      .send({ ...confirmation, action: "RUN_DIAGNOSTICS", requestId: id })
      .expect(403);
    for (const action of ["REPLAY_JOB", "SEND_EMAIL"])
      await request(app.getHttpServer())
        .post("/api/v1/admin/platform/diagnostics")
        .set("X-Test-Role", "SUPER_ADMIN")
        .send({ ...confirmation, action, requestId: id })
        .expect(422);
    await request(app.getHttpServer())
      .post("/api/v1/admin/platform/audit-export")
      .set("X-Test-Role", "ADMIN")
      .send({
        ...confirmation,
        query: {
          from: "2026-01-01",
          to: "2026-02-01",
          timezone: "UTC",
          limit: 501,
        },
      })
      .expect(422);
    await request(app.getHttpServer())
      .post("/api/v1/admin/platform/reports/export")
      .set("X-Test-Role", "ADMIN")
      .send({
        ...confirmation,
        confirmed: false,
        query: { from: "2026-01-01", to: "2026-02-01", timezone: "UTC" },
      })
      .expect(422);
    expect(service.diagnostics).not.toHaveBeenCalled();
    expect(service.exportAudit).not.toHaveBeenCalled();
  });
  it("delegates bounded confirmed exports for each authorized role", async () => {
    for (const role of ["ADMIN", "SUPER_ADMIN"])
      await request(app.getHttpServer())
        .post("/api/v1/admin/platform/audit-export")
        .set("X-Test-Role", role)
        .send({
          ...confirmation,
          query: {
            from: "2026-01-01",
            to: "2026-02-01",
            timezone: "UTC",
            limit: 2,
          },
        })
        .expect(201);
    expect(service.exportAudit).toHaveBeenCalledTimes(2);
  });
});
