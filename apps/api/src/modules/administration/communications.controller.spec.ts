import { Test } from "@nestjs/testing";
import { INestApplication, ExecutionContext } from "@nestjs/common";
import request from "supertest";
import { JwtAuthGuard, RolesGuard } from "../../common/guards";
import { GlobalExceptionFilter } from "../../common/filters/global-exception.filter";
import { UnauthorizedDomainException } from "../../common/exceptions/domain.exception";
import {
  CommunicationsController,
  OwnSupportController,
  PublicContentController,
} from "./communications.controller";
import { CommunicationsService } from "./communications.service";
const id = "d7000000-0000-4000-8000-000000000301";
describe("ADM7 actual HTTP transport with controlled authentication/use cases", () => {
  let app: INestApplication;
  const service = {
    listContent: jest.fn().mockResolvedValue({ items: [], nextCursor: null }),
    content: jest.fn(),
    createContent: jest.fn().mockResolvedValue({ id }),
    listSupport: jest.fn().mockResolvedValue({ items: [], nextCursor: null }),
    createSupport: jest.fn(),
    publicList: jest.fn().mockResolvedValue({ items: [], nextCursor: null }),
    publicContent: jest.fn().mockResolvedValue({ id }),
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [
        CommunicationsController,
        OwnSupportController,
        PublicContentController,
      ],
      providers: [
        { provide: CommunicationsService, useValue: service },
        RolesGuard,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate(ctx: ExecutionContext) {
          const req = ctx.switchToHttp().getRequest();
          const role = req.headers["x-test-role"];
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
  afterAll(async () => {
    await app?.close();
  });
  beforeEach(() => jest.clearAllMocks());
  it("denies missing authentication and every ordinary role at the real admin route", async () => {
    await request(app.getHttpServer()).get("/api/v1/admin/content").expect(401);
    for (const role of ["LEARNER", "FARMER", "BUYER", "VET"])
      await request(app.getHttpServer())
        .get("/api/v1/admin/content")
        .set("X-Test-Role", role)
        .expect(403);
    expect(service.listContent).not.toHaveBeenCalled();
  });
  it("validates and canonicalizes administrative requests before delegation", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/admin/content?limit=21")
      .set("X-Test-Role", "ADMIN")
      .expect(422);
    await request(app.getHttpServer())
      .get("/api/v1/admin/content?limit=2&kind=GUIDE")
      .set("X-Test-Role", "SUPER_ADMIN")
      .expect(200);
    expect(service.listContent).toHaveBeenCalledWith(
      expect.objectContaining({ sub: id, role: "SUPER_ADMIN" }),
      { limit: 2, kind: "GUIDE" },
    );
    await request(app.getHttpServer())
      .get("/api/v1/admin/content/not-a-uuid")
      .set("X-Test-Role", "ADMIN")
      .expect(422);
  });
  it("does not accept requester forgery, internal note fields or unsupported actions in own routes", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/support/tickets")
      .set("X-Test-Role", "LEARNER")
      .send({
        id,
        requesterId: id,
        subject: "Synthetic question",
        category: "ACCOUNT",
        body: "Test body",
      })
      .expect(422);
    await request(app.getHttpServer())
      .post(`/api/v1/support/tickets/${id}/messages`)
      .set("X-Test-Role", "LEARNER")
      .send({
        expectedVersion: 1,
        messageId: id,
        body: "Test body",
        internal: true,
      })
      .expect(422);
    await request(app.getHttpServer())
      .post(`/api/v1/support/tickets/${id}/actions`)
      .set("X-Test-Role", "LEARNER")
      .send({})
      .expect(404);
    expect(service.createSupport).not.toHaveBeenCalled();
  });
  it("keeps public reads unauthenticated and validates kind/slug without exposing an admin route", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/content/BLOG?limit=2")
      .expect(200);
    expect(service.publicList).toHaveBeenCalledWith("BLOG", { limit: 2 });
    await request(app.getHttpServer())
      .get("/api/v1/content/UNKNOWN")
      .expect(422);
    await request(app.getHttpServer())
      .get("/api/v1/content/BLOG/synthetic-slug")
      .expect(200);
    expect(service.publicContent).toHaveBeenCalledWith(
      "BLOG",
      "synthetic-slug",
    );
    await request(app.getHttpServer())
      .get("/api/v1/content/BLOG/a_bad_slug")
      .expect(422);
  });
});
