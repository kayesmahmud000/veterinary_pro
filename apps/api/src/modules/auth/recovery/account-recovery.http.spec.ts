import { Controller, Post, Req, ValidationPipe } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { request as httpRequest } from "node:http";
import { ResponseInterceptor } from "../../../common/interceptors/response.interceptor";
import { GlobalExceptionFilter } from "../../../common/filters/global-exception.filter";
import { AccountRecoveryController } from "./account-recovery.controller";
import { AccountRecoveryException } from "./account-recovery.errors";
import { AccountRecoveryService } from "./account-recovery.service";
import { ACCOUNT_RECOVERY_SERVICE } from "./account-recovery.service.interface";
import { configureAccountRecoveryTransport } from "./account-recovery.transport";
import { EnvService } from "../../../config/env.service";
import { TOKEN_SERVICE } from "../services/token.service.interface";
import { CurrentIdentityService } from "../services/current-identity.service";
import { RawBodyRequest } from "@nestjs/common";
import { Request } from "express";

@Controller("transport-regression")
class ParserRegressionController {
  @Post()
  inspect(@Req() incoming: RawBodyRequest<Request>) {
    return { raw: incoming.rawBody?.toString("utf8"), body: incoming.body };
  }
}

describe("account recovery HTTP boundary", () => {
  let app: NestExpressApplication;
  const env = { accountRecoveryEnabled: true };
  const service = { request: jest.fn(), complete: jest.fn() };
  const verifyAccessToken = jest.fn();
  const resolveIdentity = jest.fn();
  const root = "/api/v1/auth/password-reset";
  const password = { token: "a".repeat(64), newPassword: "replacement-password" };
  beforeAll(async () => {
    const fixture = await Test.createTestingModule({
      controllers: [AccountRecoveryController, ParserRegressionController],
      providers: [
        { provide: ACCOUNT_RECOVERY_SERVICE, useValue: service },
        { provide: EnvService, useValue: env },
        { provide: TOKEN_SERVICE, useValue: { verifyAccessToken } },
        { provide: CurrentIdentityService, useValue: { resolve: resolveIdentity } },
      ],
    }).compile();
    app = fixture.createNestApplication<NestExpressApplication>({ rawBody: true });
    configureAccountRecoveryTransport(app);
    app.useBodyParser("json", { limit: "512kb" });
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalInterceptors(new ResponseInterceptor(app.get(Reflector)));
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.listen(0, "127.0.0.1");
  });
  afterAll(async () => { await app?.close(); });
  beforeEach(() => {
    jest.clearAllMocks();
    env.accountRecoveryEnabled = true;
    service.request.mockReset().mockResolvedValue({ accepted: true });
    service.complete.mockReset().mockResolvedValue({ reset: true });
  });

  it("accepts a public request with 202 and one strict result envelope", async () => {
    const response = await request(app.getHttpServer()).post("/api/v1/auth/password-reset/request")
      .send({ email: "person@example.test" }).expect(202);
    expect(response.body.data).toEqual({ accepted: true });
    expect(response.body).toMatchObject({ success: true, statusCode: 202, message: "Recovery request received." });
    expect(service.request).toHaveBeenCalledWith({ email: "person@example.test", locale: "bn" }, expect.objectContaining({ socketAddress: "127.0.0.1" }));
    expect(verifyAccessToken).not.toHaveBeenCalled();
    expect(resolveIdentity).not.toHaveBeenCalled();
  });

  it("normalizes public input and does not trust the supplied bearer/forwarded address", async () => {
    await request(app.getHttpServer()).post(`${root}/request`).set("Authorization", "Bearer bogus")
      .set("X-Forwarded-For", "forged-client").send({ email: " PERSON@Example.test ", locale: "en" }).expect(202);
    expect(service.request).toHaveBeenCalledWith({ email: "person@example.test", locale: "en" },
      { socketAddress: "127.0.0.1", forwardedFor: "forged-client" });
    expect(verifyAccessToken).not.toHaveBeenCalled();
  });

  it("returns only the confirmed reset result and creates no cookies/session", async () => {
    const response = await request(app.getHttpServer()).post(`${root}/complete`).send(password).expect(200);
    expect(response.body.data).toEqual({ reset: true });
    expect(response.headers["set-cookie"]).toBeUndefined();
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(response.headers["referrer-policy"]).toBe("no-referrer");
    expect(response.text).not.toContain(password.token);
    expect(response.text).not.toContain(password.newPassword);
    expect(service.complete).toHaveBeenCalledWith(password, expect.any(Object));
  });

  it.each([null, [], "input", { email: "bad" }, { email: "a@example.test", locale: "fr" },
    { email: "a@example.test", locale: null }, { email: "a@example.test", secretUnknownKey: "do-not-reflect" }])(
    "rejects invalid request shapes without invoking the use case: %j", async (body) => {
      const response = await request(app.getHttpServer()).post(`${root}/request`).set("Content-Type", "application/json")
        .send(JSON.stringify(body)).expect(400);
      expect(response.body.errorDetails.title).toBe("VALIDATION_FAILED");
      expect(response.text).not.toContain("secretUnknownKey");
      expect(response.text).not.toContain("do-not-reflect");
      expect(service.request).not.toHaveBeenCalled();
    },
  );

  it.each(["", "a".repeat(63), "A".repeat(64), "a".repeat(64) + "\n", null])(
    "uses the same invalid-link error for malformed credentials: %j", async (token) => {
      const response = await request(app.getHttpServer()).post(`${root}/complete`).send({ ...password, token }).expect(400);
      expect(response.body.errorDetails.title).toBe("RESET_LINK_INVALID");
      expect(service.complete).not.toHaveBeenCalled();
    },
  );

  it.each(["a".repeat(7), "a".repeat(73), "ক".repeat(25), "😀".repeat(19)])(
    "validates password policy before any credential lookup", async (newPassword) => {
      const response = await request(app.getHttpServer()).post(`${root}/complete`).send({ ...password, newPassword }).expect(400);
      expect(response.body.errorDetails.title).toBe("VALIDATION_FAILED");
      expect(response.body.errors).toEqual([{ field: "newPassword", message: "Invalid field." }]);
      expect(service.complete).not.toHaveBeenCalled();
    },
  );

  it.each(["a".repeat(72), "ক".repeat(24), "😀".repeat(4), "  spaced  "])(
    "preserves an admissible password across Nest and shared validation", async (newPassword) => {
      await request(app.getHttpServer()).post(`${root}/complete`).send({ ...password, newPassword }).expect(200);
      expect(service.complete).toHaveBeenCalledWith({ ...password, newPassword }, expect.any(Object));
    },
  );

  it("rejects query/unknown keys without reflecting submitted secrets or trace text", async () => {
    const response = await request(app.getHttpServer()).post(`${root}/request?token=query-secret`)
      .set("X-Trace-Id", "trace-secret").send({ email: "a@example.test" }).expect(400);
    expect(response.text).not.toContain("query-secret");
    expect(response.text).not.toContain("trace-secret");
    expect(response.body.errorDetails.title).toBe("VALIDATION_FAILED");
    const ok = await request(app.getHttpServer()).post(`${root}/request`).set("X-Trace-Id", "trace-secret")
      .send({ email: "a@example.test" }).expect(202);
    expect(ok.text).not.toContain("trace-secret");
  });

  it("rejects unknown keys before class-transformer can discard prototype-related names", async () => {
    for (const key of ["constructor", "__proto__"]) {
      const response = await request(app.getHttpServer()).post(`${root}/request`)
        .set("Content-Type", "application/json")
        .send(`{"email":"a@example.test","${key}":{"secret":"hidden"}}`).expect(400);
      expect(response.body.errorDetails.title).toBe("VALIDATION_FAILED");
      expect(response.text).not.toContain("hidden");
    }
    expect(service.request).not.toHaveBeenCalled();
  });

  it("sanitizes malformed JSON and rejects non-JSON content", async () => {
    for (const [type, body] of [["application/json", '{"token":"json-secret"'], ["text/plain", "text-secret"]]) {
      const response = await request(app.getHttpServer()).post(`${root}/complete`).set("Content-Type", type).send(body).expect(400);
      expect(response.body.errorDetails.title).toBe("VALIDATION_FAILED");
      expect(response.text).not.toContain("secret");
    }
    expect(service.complete).not.toHaveBeenCalled();
  });

  it("enforces the exact 8 KiB raw UTF-8 limit, including insignificant whitespace", async () => {
    const body = JSON.stringify({ email: "a@example.test" });
    await request(app.getHttpServer()).post(`${root}/request`).set("Content-Type", "application/json").send(body.padEnd(8192, " ")).expect(202);
    for (const raw of [body.padEnd(8193, " "), JSON.stringify({ email: "ক".repeat(3000) })]) {
      const response = await request(app.getHttpServer()).post(`${root}/request`).set("Content-Type", "application/json").send(raw).expect(413);
      expect(response.body.errorDetails.title).toBe("PAYLOAD_TOO_LARGE");
    }
    expect(service.request).toHaveBeenCalledTimes(1);
  });

  it("bounds chunked bodies without a Content-Length header", async () => {
    const address = app.getHttpServer().address();
    if (!address || typeof address === "string") throw new Error("Expected local test server");
    const outcome = await new Promise<{ status: number; body: string }>((resolve, reject) => {
      const outgoing = httpRequest({ host: "127.0.0.1", port: address.port, path: `${root}/request`, method: "POST",
        headers: { "Content-Type": "application/json", "Transfer-Encoding": "chunked" } }, (incoming) => {
        let body = "";
        incoming.on("data", (chunk) => { body += chunk; });
        incoming.on("end", () => resolve({ status: incoming.statusCode!, body }));
        incoming.on("error", reject);
      });
      outgoing.on("error", reject);
      outgoing.write('{"email":"a@example.test"}');
      outgoing.write(" ".repeat(4096));
      outgoing.end(" ".repeat(4096));
    });
    expect(outcome.status).toBe(413);
    expect(JSON.parse(outcome.body).errorDetails.title).toBe("PAYLOAD_TOO_LARGE");
    expect(service.request).not.toHaveBeenCalled();
  });

  it("preserves the general parser limit and signed-webhook raw bytes", async () => {
    const raw = '{ "message": "synthetic", "spacing": true }';
    const response = await request(app.getHttpServer()).post("/api/v1/transport-regression")
      .set("Content-Type", "application/json").send(raw).expect(201);
    expect(response.body.data.raw).toBe(raw);
    expect(response.body.data.body).toEqual(JSON.parse(raw));
    await request(app.getHttpServer()).post("/api/v1/transport-regression").send({ message: "a".repeat(16000) }).expect(201);
  });

  it("does not expose GET routes or accept unrelated methods", async () => {
    await request(app.getHttpServer()).get(`${root}/complete`).expect(404);
    await request(app.getHttpServer()).put(`${root}/request`).set("Content-Type", "application/json").send({}).expect(404);
    expect(service.request).not.toHaveBeenCalled();
    expect(service.complete).not.toHaveBeenCalled();
  });

  it("fails closed independently of accounts while disabled or not yet implemented", async () => {
    env.accountRecoveryEnabled = false;
    for (const [action, input] of [["request", { email: "unknown@example.test" }], ["complete", password]]) {
      const response = await request(app.getHttpServer()).post(`${root}/${action}`).send(input).expect(503);
      expect(response.body.errorDetails.title).toBe("RECOVERY_UNAVAILABLE");
    }
    expect(service.request).not.toHaveBeenCalled();
    expect(service.complete).not.toHaveBeenCalled();
    env.accountRecoveryEnabled = true;
    const closed = new AccountRecoveryService();
    service.request.mockImplementation((...args) => closed.request(args[0], args[1]));
    service.complete.mockImplementation((...args) => closed.complete(args[0], args[1]));
    await request(app.getHttpServer()).post(`${root}/request`).send({ email: "unknown@example.test" }).expect(503);
    await request(app.getHttpServer()).post(`${root}/complete`).send(password).expect(503);
  });

  it("contains internal/provider failures and rejects unexpected successful data", async () => {
    service.request.mockRejectedValueOnce(new Error("provider-secret and recipient@example.test"));
    const failed = await request(app.getHttpServer()).post(`${root}/request`).send({ email: "a@example.test" }).expect(503);
    expect(failed.text).not.toContain("provider-secret");
    expect(failed.text).not.toContain("recipient@example.test");
    service.complete.mockResolvedValueOnce({ reset: true, accessToken: "service-secret" });
    const malformed = await request(app.getHttpServer()).post(`${root}/complete`).send(password).expect(503);
    expect(malformed.text).not.toContain("service-secret");
  });

  it("uses identical credential-failure responses and conservative rate-limit feedback", async () => {
    service.complete.mockRejectedValueOnce(new AccountRecoveryException("RESET_LINK_INVALID"));
    const invalid = await request(app.getHttpServer()).post(`${root}/complete`).send(password).expect(400);
    expect(invalid.body.message).toBe("Reset link is invalid or expired.");
    service.complete.mockRejectedValueOnce(new AccountRecoveryException("RATE_LIMITED"));
    const limited = await request(app.getHttpServer()).post(`${root}/complete`).send(password).expect(429);
    expect(limited.headers["retry-after"]).toBe("900");
    expect(limited.body.errorDetails.title).toBe("RATE_LIMITED");
  });
});
