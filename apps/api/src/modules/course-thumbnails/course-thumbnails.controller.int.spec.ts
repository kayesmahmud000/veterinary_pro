import { request as httpRequest } from "node:http";
import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import request from "supertest";
import sharp from "sharp";
import {
  UserRole,
  UserStatus,
  COURSE_THUMBNAIL_MAX_BYTES,
} from "@vetralink/shared-types";
import { TOKEN_SERVICE } from "../auth/services/token.service.interface";
import { CurrentIdentityService } from "../auth/services/current-identity.service";
import { WorkflowRateLimiter } from "../../common/security/workflow-rate-limiter";
import { EnvService } from "../../config";
import { ResponseInterceptor } from "../../common/interceptors/response.interceptor";
import { GlobalExceptionFilter } from "../../common/filters/global-exception.filter";
import { WorkflowException } from "../../common/exceptions/domain.exception";
import {
  CourseThumbnailsController,
  ThumbnailUploadGuard,
  ThumbnailRequestLimit,
} from "./course-thumbnails.controller";
import { CourseThumbnailsService } from "./course-thumbnails.service";
import { THUMBNAIL_STORAGE } from "./thumbnail-storage.interface";
import { validateCloudinaryResult } from "./cloudinary-thumbnail-storage.service";
const actor = {
  sub: "550e8400-e29b-41d4-a716-446655440001",
  email: "admin@example.test",
  role: UserRole.ADMIN,
  status: UserStatus.ACTIVE,
  authorizationVersion: 1,
};
describe("course thumbnail HTTP security and storage boundary", () => {
  let app: INestApplication, bytes: Buffer;
  const storage = { put: jest.fn() },
    limiter = { hit: jest.fn() },
    identities = { resolve: jest.fn() },
    env = {
      cloudinaryThumbnailsEnabled: true,
      cloudinaryThumbnailsFolder: "course-thumbnails",
    };
  beforeAll(async () => {
    bytes = await sharp({
      create: { width: 10, height: 10, channels: 3, background: "red" },
    })
      .png()
      .toBuffer();
    const module = await Test.createTestingModule({
      controllers: [CourseThumbnailsController],
      providers: [
        CourseThumbnailsService,
        ThumbnailUploadGuard,
        ThumbnailRequestLimit,
        { provide: EnvService, useValue: env },
        { provide: CurrentIdentityService, useValue: identities },
        { provide: WorkflowRateLimiter, useValue: limiter },
        { provide: THUMBNAIL_STORAGE, useValue: storage },
        {
          provide: TOKEN_SERVICE,
          useValue: {
            verifyAccessToken: jest.fn(async (token: string) => ({
              ...actor,
              role: token as UserRole,
            })),
          },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalInterceptors(new ResponseInterceptor(app.get(Reflector)));
    await app.init();
  });
  beforeEach(() => {
    jest.clearAllMocks();
    env.cloudinaryThumbnailsEnabled = true;
    limiter.hit.mockResolvedValue(undefined);
    identities.resolve.mockImplementation(async (claims) => claims);
    storage.put.mockResolvedValue({
      url: "https://res.cloudinary.com/test/image/upload/v1/course-thumbnails/test.webp",
    });
  });
  afterAll(async () => {
    await app?.close();
  });
  const send = (role = "ADMIN") =>
    request(app.getHttpServer())
      .post("/admin/courses/thumbnails")
      .set("Authorization", `Bearer ${role}`);
  it.each(["ADMIN", "SUPER_ADMIN"])(
    "accepts active %s and stores normalized bytes with a generated public ID",
    async (role) => {
      const res = await send(role).attach("file", bytes, {
        filename: "cover.png",
        contentType: "image/png",
      });
      expect(res.status).toBe(201);
      expect(res.body.data.url).toContain("res.cloudinary.com");
      expect(storage.put).toHaveBeenCalledTimes(1);
      expect(storage.put.mock.calls[0][0]).toMatch(
        /^course-thumbnails\/[a-f0-9-]{36}$/,
      );
      expect(
        (await sharp(storage.put.mock.calls[0][1]).metadata()).format,
      ).toBe("webp");
      expect(limiter.hit).toHaveBeenCalledWith(
        "course-thumbnail-upload",
        actor.sub,
        10,
        60,
      );
    },
  );
  it("denies absent token, ordinary roles and revoked identities before storage", async () => {
    expect(
      (
        await request(app.getHttpServer())
          .post("/admin/courses/thumbnails")
          .attach("file", bytes, "cover.png")
      ).status,
    ).toBe(401);
    expect(
      (await send("LEARNER").attach("file", bytes, "cover.png")).status,
    ).toBe(403);
    identities.resolve.mockRejectedValue(
      new WorkflowException("AUTHORIZATION_CHANGED", "Session changed", 401),
    );
    expect((await send().attach("file", bytes, "cover.png")).status).toBe(401);
    expect(storage.put).not.toHaveBeenCalled();
  });
  it("rechecks identity after decoding and fails closed on rate limiter/provider failure", async () => {
    identities.resolve
      .mockResolvedValueOnce(actor)
      .mockRejectedValueOnce(
        new WorkflowException("AUTHORIZATION_CHANGED", "Changed", 401),
      );
    expect((await send().attach("file", bytes, "cover.png")).status).toBe(401);
    expect(storage.put).not.toHaveBeenCalled();
    identities.resolve.mockImplementation(async (claims) => claims);
    limiter.hit.mockRejectedValue(
      new WorkflowException("RATE_LIMITED", "Retry", 429),
    );
    expect((await send().attach("file", bytes, "cover.png")).status).toBe(429);
    expect(storage.put).not.toHaveBeenCalled();
    limiter.hit.mockResolvedValue(undefined);
    storage.put.mockRejectedValue(
      new WorkflowException("THUMBNAIL_UNAVAILABLE", "Retry", 503),
    );
    expect((await send().attach("file", bytes, "cover.png")).status).toBe(503);
  });
  it("rejects corrupt, disguised, missing, oversize and extra files/fields", async () => {
    for (const [content, filename, type, status] of [
      [Buffer.from("fake"), "fake.png", "image/png", 422],
      [bytes, "fake.jpg", "image/png", 415],
      [bytes, "disguised.jpg", "image/jpeg", 422],
      [
        Buffer.alloc(COURSE_THUMBNAIL_MAX_BYTES + 1),
        "big.png",
        "image/png",
        413,
      ],
    ] as const)
      expect(
        (await send().attach("file", content, { filename, contentType: type }))
          .status,
      ).toBe(status);
    expect(
      (await send().field("extra", "bad").attach("file", bytes, "cover.png"))
        .status,
    ).toBeGreaterThanOrEqual(400);
    expect(
      (
        await send()
          .attach("file", bytes, "one.png")
          .attach("file", bytes, "two.png")
      ).status,
    ).toBeGreaterThanOrEqual(400);
    expect(
      (await send().set("Content-Type", "application/json").send({})).status,
    ).toBe(415);
    expect(storage.put).not.toHaveBeenCalled();
  });
  it("bounds a chunked request without a trustworthy Content-Length", async () => {
    const server = app.getHttpServer();
    if (!server.listening)
      await new Promise<void>((resolve) =>
        server.listen(0, "127.0.0.1", resolve),
      );
    const port = server.address().port;
    const status = await new Promise<number>((resolve, reject) => {
      const request = httpRequest(
        {
          host: "127.0.0.1",
          port,
          path: "/admin/courses/thumbnails",
          method: "POST",
          headers: {
            Authorization: "Bearer ADMIN",
            "Content-Type": "multipart/form-data; boundary=synthetic",
            "Transfer-Encoding": "chunked",
          },
        },
        (response) => {
          response.resume();
          response.on("end", () => resolve(response.statusCode ?? 0));
        },
      );
      request.on("error", reject);
      request.end(Buffer.alloc(COURSE_THUMBNAIL_MAX_BYTES + 64 * 1024 + 1, 97));
    });
    expect(status).toBe(413);
    expect(storage.put).not.toHaveBeenCalled();
  });
  it("disabled configuration returns unavailable without storage", async () => {
    env.cloudinaryThumbnailsEnabled = false;
    expect((await send().attach("file", bytes, "cover.png")).status).toBe(503);
    expect(storage.put).not.toHaveBeenCalled();
  });
});
describe("Cloudinary acknowledgement validation", () => {
  const good = {
    public_id: "course-thumbnails/test",
    version: 123,
    format: "webp",
    secure_url:
      "https://res.cloudinary.com/test-cloud/image/upload/v123/course-thumbnails/test.webp",
  };
  it("accepts only the versioned URL for this cloud and generated asset", () => {
    expect(
      validateCloudinaryResult(good, "test-cloud", good.public_id),
    ).toEqual({ url: good.secure_url });
  });
  it.each([
    { existing: true },
    { version: 0 },
    { format: "png" },
    { public_id: "another" },
    { secure_url: "https://evil.example/image.webp" },
    { secure_url: good.secure_url + "?secret=x" },
    { secure_url: good.secure_url.replace("test-cloud", "other-cloud") },
  ])("rejects a mismatched response %o", (change) => {
    expect(() =>
      validateCloudinaryResult(
        { ...good, ...change },
        "test-cloud",
        good.public_id,
      ),
    ).toThrow();
  });
});
