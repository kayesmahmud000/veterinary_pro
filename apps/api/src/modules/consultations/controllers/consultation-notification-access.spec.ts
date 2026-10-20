import { ExecutionContext, INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { of } from "rxjs";
import request = require("supertest");
import { GlobalExceptionFilter } from "../../../common/filters/global-exception.filter";
import { UnauthorizedDomainException } from "../../../common/exceptions/domain.exception";
import { JwtAuthGuard, RolesGuard } from "../../../common/guards";
import { CONSULTATION_REPOSITORY } from "../repositories/consultation.repository.interface";
import { CONSULTATION_NOTIFICATION_SERVICE } from "../services/consultation-notification.service.interface";
import { ConsultationNotificationController } from "./consultation-notification.controller";

describe("Veterinarian notification stream access (real HTTP/SSE transport)", () => {
  const actor = "f1000000-0000-4000-8000-000000000001";
  const other = "f1000000-0000-4000-8000-000000000002";
  const eventId = "f1000000-0000-4000-8000-000000000003";
  const stream = jest.fn(() =>
    of({
      type: "consultation_assigned",
      id: eventId,
      data: { title: "Synthetic assignment" },
    }),
  );
  let app: INestApplication;
  const url = (id: string) => `/consultations/vets/${id}/notifications/stream`;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ConsultationNotificationController],
      providers: [
        {
          provide: CONSULTATION_NOTIFICATION_SERVICE,
          useValue: { getNotificationStream: stream },
        },
        { provide: CONSULTATION_REPOSITORY, useValue: {} },
        RolesGuard,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          const req = context.switchToHttp().getRequest();
          const role = req.headers["x-test-role"];
          if (!role) throw new UnauthorizedDomainException();
          req.user = { sub: actor, role, status: "ACTIVE" };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useLogger(false);
    await app.init();
  });
  afterAll(async () => {
    await app?.close();
  });
  beforeEach(() => jest.clearAllMocks());

  it("requires authentication before allocating a stream", async () => {
    await request(app.getHttpServer()).get(url(actor)).expect(401);
    expect(stream).not.toHaveBeenCalled();
  });

  it.each(["LEARNER", "FARMER", "BUYER"])(
    "denies %s even for their own ID",
    async (role) => {
      await request(app.getHttpServer())
        .get(url(actor))
        .set("X-Test-Role", role)
        .expect(403);
      expect(stream).not.toHaveBeenCalled();
    },
  );

  it("denies a VET subscribing to another veterinarian before allocating a stream", async () => {
    await request(app.getHttpServer())
      .get(url(other))
      .set("X-Test-Role", "VET")
      .expect(403);
    expect(stream).not.toHaveBeenCalled();
  });

  it.each(["VET", "ADMIN", "SUPER_ADMIN"])(
    "preserves authorized %s SSE delivery",
    async (role) => {
      const vetId = role === "VET" ? actor : other;
      const response = await request(app.getHttpServer())
        .get(url(vetId))
        .set("X-Test-Role", role)
        .expect(200);
      expect(response.headers["content-type"]).toContain("text/event-stream");
      expect(response.text).toContain("event: consultation_assigned\n");
      expect(response.text).toContain(`id: ${eventId}\n`);
      expect(response.text).toContain('data: {"title":"Synthetic assignment"}');
      expect(stream).toHaveBeenCalledTimes(1);
      expect(stream).toHaveBeenCalledWith(vetId);
    },
  );
});
