import { WorkflowException } from "../../common/exceptions/domain.exception";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { JwtPayload, UserRole } from "@vetralink/shared-types";
import {
  AdminCourseEnrollmentsController,
  AdminUserCoursesController,
} from "./admin-course-enrollments.controller";
import { AdminCourseEnrollmentsService } from "./admin-course-enrollments.service";
import { TOKEN_SERVICE } from "../auth/services/token.service.interface";
import { CurrentIdentityService } from "../auth/services/current-identity.service";
import { GlobalExceptionFilter } from "../../common/filters/global-exception.filter";
const id = "11111111-1111-4111-8111-111111111111";
describe("Enrollment administrative HTTP privacy and roles", () => {
  let app: INestApplication;
  const service = {
    list: async () => ({ items: [] }),
    userCourses: async () => ({ items: [] }),
    candidates: async () => ({ items: [] }),
    createUserAndEnroll: async () => ({ accountCreated: true }),
    add: async () => ({ changed: true }),
    act: async () => ({ changed: true }),
  };
  beforeAll(async () => {
    const m = await Test.createTestingModule({
      controllers: [
        AdminCourseEnrollmentsController,
        AdminUserCoursesController,
      ],
      providers: [
        { provide: AdminCourseEnrollmentsService, useValue: service },
        {
          provide: TOKEN_SERVICE,
          useValue: {
            verifyAccessToken: async (role: string) =>
              ({ sub: id, role, authorizationVersion: 0 }) as JwtPayload,
          },
        },
        {
          provide: CurrentIdentityService,
          useValue: { resolve: async (c: JwtPayload) => c },
        },
      ],
    }).compile();
    app = m.createNestApplication();
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();
  });
  afterAll(async () => app?.close());
  it("denies missing and ordinary identities", async () => {
    await request(app.getHttpServer())
      .get(`/admin/courses/${id}/enrollments`)
      .expect(401);
    for (const role of [
      UserRole.LEARNER,
      UserRole.FARMER,
      UserRole.BUYER,
      UserRole.VET,
    ])
      await request(app.getHttpServer())
        .post(`/admin/courses/${id}/enrollments/create-user`)
        .auth(role, { type: "bearer" })
        .send({})
        .expect(403);
  });
  it.each([UserRole.ADMIN, UserRole.SUPER_ADMIN])(
    "allows %s directory routes",
    async (role) => {
      await request(app.getHttpServer())
        .get(`/admin/courses/${id}/enrollments`)
        .auth(role, { type: "bearer" })
        .expect(200)
        .expect("Cache-Control", "private, no-store");
      await request(app.getHttpServer())
        .get(`/admin/directory/users/${id}/courses`)
        .auth(role, { type: "bearer" })
        .expect(200);
    },
  );
  it("rejects invalid secrets without echoing unknown property values or keys", async () => {
    const response = await request(app.getHttpServer())
      .post(`/admin/courses/${id}/enrollments/create-user`)
      .auth(UserRole.ADMIN, { type: "bearer" })
      .send({
        name: "x",
        email: "invalid",
        newUserPassword: "secret-sentinel",
        actorPassword: "actor-sentinel",
        "secret-key-sentinel": "value-sentinel",
      })
      .expect(422);
    expect(JSON.stringify(response.body)).not.toMatch(/sentinel/);
  });
  it("returns rate limit recovery timing without secret details", async () => {
    const original = service.createUserAndEnroll;
    service.createUserAndEnroll = async () => {
      throw Object.assign(
        new WorkflowException("RATE_LIMITED", "Too many attempts.", 429),
        { details: { retryAfter: 900 } },
      );
    };
    try {
      await request(app.getHttpServer())
        .post(`/admin/courses/${id}/enrollments/create-user`)
        .auth(UserRole.ADMIN, { type: "bearer" })
        .send({
          name: "New user",
          email: "new@example.test",
          newUserPassword: "synthetic-new-pass",
          actorPassword: "synthetic-admin-pass",
          reason: "Requested new enrollment",
        })
        .expect(429)
        .expect("Retry-After", "900");
    } finally {
      service.createUserAndEnroll = original;
    }
  });
});
