import { randomUUID } from "crypto";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Logger } from "@nestjs/common";
import {
  AnimalSpecies,
  FarmType,
  FarmRole,
  UserRole,
  ProfessionalRole,
  UserStatus,
} from "@vetralink/shared-types";
import { EnvSchema } from "../../config/env.schema";
import { EnvService } from "../../config/env.service";
import { PiiCryptoService } from "../crypto/pii-crypto.service";
import { PrismaService } from "../../modules/prisma/prisma.service";
import { TransactionManager } from "../../modules/prisma/transaction/transaction.manager";
import { UserRepository } from "../../modules/users/repositories/user.repository";
import { UserEntity } from "../../modules/users/entities/user.entity";
import { AuditLogRepository } from "../../modules/audit/repositories/audit-log.repository";
import { TokenService } from "../../modules/auth/services/token.service";
import { BcryptPasswordHasher } from "../../modules/auth/services/bcrypt-password-hasher.service";
import { RefreshTokenRepository } from "../../modules/auth/repositories/refresh-token.repository";
import { AuthService } from "../../modules/auth/services/auth.service";
import { CurrentIdentityService } from "../../modules/auth/services/current-identity.service";
import { RoleRequestRepository } from "../../modules/role-requests/repositories/role-request.repository";
import { RoleRequestService } from "../../modules/role-requests/services/role-request.service";
import { RoleNotificationRepository } from "../../modules/role-notifications/role-notification.repository";
import { PrivilegedRoleService } from "../../modules/administration/privileged-role.service";
import { FarmOnboardingRepository } from "../../modules/farms/repositories/farm-onboarding.repository";
import { FarmOnboardingService } from "../../modules/farms/services/farm-onboarding.service";
import { FarmMemberRepository } from "../../modules/farms/repositories/farm-member.repository";
import { FarmMembersService } from "../../modules/farms/services/farm-members.service";
import { SubscriptionQuotaService } from "../../modules/subscriptions/services/subscription-quota.service";
import { SubscriptionRepository } from "../../modules/subscriptions/repositories/subscription.repository";
import { SubscriptionPlanRepository } from "../../modules/subscriptions/repositories/subscription-plan.repository";
import { SubscriptionUsageRepository } from "../../modules/subscriptions/repositories/subscription-usage.repository";
import { WorkflowRateLimiter } from "./workflow-rate-limiter";
import { TenantGuard } from "../guards/tenant.guard";

// Opt-in only. Never load a project .env or reset a caller-selected database.
const database = process.env["ROLE_TEST_DATABASE_URL"];
const live = database ? describe : describe.skip;
const runId = randomUUID();
const password = "SyntheticTestPassword123!";
live("Role workflows against isolated PostgreSQL and Redis", () => {
  let prisma: PrismaService,
    users: UserRepository,
    auth: AuthService,
    identities: CurrentIdentityService,
    tokens: TokenService,
    roleRequests: RoleRequestService,
    admin: PrivilegedRoleService,
    onboard: FarmOnboardingService,
    members: FarmMembersService,
    audit: AuditLogRepository,
    tx: TransactionManager,
    events: RoleNotificationRepository,
    limiter: WorkflowRateLimiter;
  let hash: string, reviewer: UserEntity, superAdmin: UserEntity;
  const create = async (role = UserRole.LEARNER, extra: any = {}) =>
    users.create(
      UserEntity.create({
        email: `${randomUUID()}-${runId}@roles.example.test`,
        name: "Synthetic Test User",
        passwordHash: hash,
        role,
        ...extra,
      }),
    );
  const application = (
    key = randomUUID(),
    targetRole = ProfessionalRole.BUYER,
  ): any => ({
    targetRole,
    questionnaireVersion: 1,
    locale: "en",
    submissionKey: key,
    answers:
      targetRole === ProfessionalRole.BUYER
        ? {
            use: "PERSONAL",
            district: "Dhaka",
            interests: "Animal health products",
            reason: "I need animal care products for my household.",
            consent: true,
          }
        : {
            professionalName: "Synthetic Vet",
            qualification: "DVM",
            licensingBody: "Test authority",
            licenseNumber: "TEST-123",
            district: "Dhaka",
            experienceYears: 2,
            species: [AnimalSpecies.COW],
            specialties: "Cattle health",
            reason: "I would like to offer care to local farms.",
            consent: true,
          },
  });
  const farm = (key = randomUUID()): any => ({
    mode: "create",
    submissionKey: key,
    name: "Synthetic Farm",
    farmType: FarmType.DAIRY,
    country: "Bangladesh",
    district: "Dhaka",
    upazila: "Savar",
    address: "Synthetic farm road 12",
    species: [AnimalSpecies.COW],
    animalCount: 5,
    experienceYears: 2,
  });
  beforeAll(async () => {
    const url = new URL(database!);
    if (
      url.hostname !== "127.0.0.1" ||
      url.port !== "55432" ||
      url.pathname !== "/role_test"
    )
      throw new Error(
        "Use the explicitly isolated role_test container on 127.0.0.1:55432.",
      );
    process.env["DATABASE_URL"] = database;
    Logger.overrideLogger(false);
    const env = new EnvService(
      new ConfigService(
        EnvSchema.parse({
          NODE_ENV: "test",
          DATABASE_URL: database,
          REDIS_URL: "redis://127.0.0.1:56379",
        }),
      ),
    );
    prisma = new PrismaService(new ConfigService({ NODE_ENV: "production" }));
    await prisma.$connect();
    const pii = new PiiCryptoService(env);
    users = new UserRepository(prisma, pii);
    tx = new TransactionManager(prisma);
    audit = new AuditLogRepository(prisma);
    events = new RoleNotificationRepository(prisma, audit);
    limiter = new WorkflowRateLimiter(env);
    const passwords = new BcryptPasswordHasher();
    hash = await passwords.hash(password);
    tokens = new TokenService(new JwtService(), env);
    const refresh = new RefreshTokenRepository(prisma);
    auth = new AuthService(users, refresh, passwords, tokens, tx, pii, audit);
    identities = new CurrentIdentityService(users, env);
    const requests = new RoleRequestRepository(prisma);
    roleRequests = new RoleRequestService(
      users,
      audit,
      tx,
      requests,
      events,
      limiter,
    );
    admin = new PrivilegedRoleService(
      users,
      passwords,
      refresh,
      tx,
      audit,
      requests,
      events,
      limiter,
    );
    const farms = new FarmOnboardingRepository(prisma);
    onboard = new FarmOnboardingService(users, tx, audit, farms);
    const usage = new SubscriptionUsageRepository(prisma);
    const quota = new SubscriptionQuotaService(
      new SubscriptionRepository(prisma),
      new SubscriptionPlanRepository(prisma),
      usage,
    );
    members = new FarmMembersService(
      new FarmMemberRepository(prisma),
      users,
      tx,
      audit,
      quota,
      farms,
    );
    reviewer = await create(UserRole.ADMIN);
    superAdmin = await create(UserRole.SUPER_ADMIN);
  }, 30000);
  afterAll(async () => {
    limiter?.onModuleDestroy();
    await prisma?.$disconnect();
  });
  it("defaults public registration to Learner and audits the transaction", async () => {
    const response = await auth.register({
      email: `${randomUUID()}@roles.example.test`,
      name: "New Learner",
      password,
    });
    expect(response.user.role).toBe(UserRole.LEARNER);
    expect(response.user.farmerOnboardingRequired).toBe(false);
    expect(
      await prisma.auditLog.count({
        where: { entityId: response.user.id, action: "USER_REGISTERED" },
      }),
    ).toBe(1);
  });
  it.each([UserRole.ADMIN, UserRole.SUPER_ADMIN])(
    "rejects public %s registration",
    async (role) => {
      await expect(
        auth.register({
          email: `${randomUUID()}@roles.example.test`,
          name: "Forged Admin",
          password,
          role: role as any,
        }),
      ).rejects.toMatchObject({ statusCode: 403 });
    },
  );
  it.each(Object.values(UserRole))(
    "signs in stored %s accounts",
    async (role) => {
      const user = await create(role);
      const response = await auth.login({ email: user.email, password });
      expect(response.user.role).toBe(role);
      expect(
        (
          await identities.resolve(
            await tokens.verifyAccessToken(response.tokens.accessToken),
          )
        ).role,
      ).toBe(role);
    },
  );
  it("serializes two applications and enforces one pending request", async () => {
    const user = await create();
    const results = await Promise.allSettled([
      roleRequests.submit(user.id, application()),
      roleRequests.submit(user.id, application()),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(
      await prisma.roleUpgradeRequest.count({
        where: { applicantUserId: user.id, status: "PENDING" },
      }),
    ).toBe(1);
  });
  it("replays the same submission and rejects changed answers", async () => {
    const user = await create(),
      input = application();
    const first = await roleRequests.submit(user.id, input);
    const second = await roleRequests.submit(user.id, input);
    expect(second.id).toBe(first.id);
    await expect(
      roleRequests.submit(user.id, {
        ...input,
        answers: { ...input.answers, district: "Sylhet" },
      }),
    ).rejects.toMatchObject({ errorCode: "SUBMISSION_KEY_CONFLICT" });
  });
  it("serializes decisions, updates the role, and invalidates old access claims", async () => {
    const user = await create(),
      login = await auth.login({ email: user.email, password }),
      request = await roleRequests.submit(user.id, application());
    const decision = {
      decision: "APPROVED" as const,
      expectedRequestVersion: 1,
      expectedApplicantRoleVersion: 0,
    };
    const results = await Promise.allSettled([
      roleRequests.decide(reviewer.id, request.id, decision),
      roleRequests.decide(reviewer.id, request.id, decision),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await users.findById(user.id))!.role).toBe(UserRole.BUYER);
    await expect(
      identities.resolve(
        await tokens.verifyAccessToken(login.tokens.accessToken),
      ),
    ).rejects.toMatchObject({ errorCode: "AUTHORIZATION_CHANGED" });
    const fresh = await auth.refreshToken(login.tokens.refreshToken);
    expect(
      (await tokens.verifyAccessToken(fresh.tokens.accessToken)).role,
    ).toBe(UserRole.BUYER);
    expect(
      await prisma.auditLog.count({
        where: { entityId: request.id, action: "ROLE_REQUEST_APPROVED" },
      }),
    ).toBe(1);
  });
  it("requires approved farmers to complete onboarding without implicitly creating a farm", async () => {
    const user = await create(),
      login = await auth.login({ email: user.email, password });
    const request = await roleRequests.submit(user.id, {
      ...application(),
      targetRole: ProfessionalRole.FARMER,
      answers: {
        farmName: "Planned dairy farm",
        farmType: FarmType.DAIRY,
        district: "Dhaka",
        upazila: "Savar",
        species: [AnimalSpecies.COW],
        animalCount: 5,
        experienceYears: 2,
        reason: "I intend to operate a local dairy farm.",
        consent: true,
      },
    });
    await roleRequests.decide(reviewer.id, request.id, {
      decision: "APPROVED",
      expectedRequestVersion: 1,
      expectedApplicantRoleVersion: 0,
    });
    expect((await users.findById(user.id))!.farmerOnboardingRequired).toBe(
      true,
    );
    expect(await prisma.farm.count({ where: { ownerId: user.id } })).toBe(0);
    const refreshed = await auth.refreshToken(login.tokens.refreshToken);
    expect(
      await identities.resolve(
        await tokens.verifyAccessToken(refreshed.tokens.accessToken),
      ),
    ).toMatchObject({ role: UserRole.FARMER, farmerOnboardingRequired: true });
  });
  it("rolls back role and decision if audit insertion fails", async () => {
    const user = await create(),
      request = await roleRequests.submit(user.id, application());
    const spy = jest
      .spyOn(audit, "record")
      .mockRejectedValueOnce(new Error("Audit unavailable"));
    await expect(
      roleRequests.decide(reviewer.id, request.id, {
        decision: "APPROVED",
        expectedRequestVersion: 1,
        expectedApplicantRoleVersion: 0,
      }),
    ).rejects.toThrow("Audit unavailable");
    spy.mockRestore();
    expect((await users.findById(user.id))!.role).toBe(UserRole.LEARNER);
    expect(
      (await prisma.roleUpgradeRequest.findUnique({
        where: { id: request.id },
      }))!.status,
    ).toBe("PENDING");
  });
  it("keeps private notes out of applicant responses and queues", async () => {
    const user = await create(),
      request = await roleRequests.submit(user.id, application());
    await roleRequests.decide(reviewer.id, request.id, {
      decision: "REJECTED",
      expectedRequestVersion: 1,
      expectedApplicantRoleVersion: 0,
      publicReason: "Please provide more details.",
      privateNote: "Private reviewer assessment.",
    });
    expect(
      JSON.stringify(await roleRequests.own(user.id, request.id)),
    ).not.toContain("Private reviewer");
    await expect(
      roleRequests.own((await create()).id, request.id),
    ).rejects.toMatchObject({ statusCode: 404 });
    const queue = await roleRequests.queue(reviewer.id, { limit: 1 });
    expect(queue.requests).toHaveLength(1);
    expect(queue.requests[0]).not.toHaveProperty("answers");
  });
  it("requires vet verification and atomically initializes an unavailable VetProfile", async () => {
    const user = await create(),
      request = await roleRequests.submit(
        user.id,
        application(randomUUID(), ProfessionalRole.VET),
      );
    const input = {
      decision: "APPROVED" as const,
      expectedRequestVersion: 1,
      expectedApplicantRoleVersion: 0,
    };
    await expect(
      roleRequests.decide(reviewer.id, request.id, input),
    ).rejects.toMatchObject({ errorCode: "VET_VERIFICATION_REQUIRED" });
    await roleRequests.decide(reviewer.id, request.id, {
      ...input,
      qualificationVerificationNote:
        "Synthetic qualification checked by reviewer.",
    });
    expect(
      await prisma.vetProfile.findUnique({ where: { userId: user.id } }),
    ).toMatchObject({ licenseNumber: "TEST-123", isAvailable: false });
  });
  it("gates an incomplete farmer, then atomically creates farm and OWNER", async () => {
    const user = await create(UserRole.FARMER);
    expect((await onboard.status(user.id)).required).toBe(true);
    const guard = new TenantGuard(
      { getAllAndOverride: () => undefined } as any,
      new FarmMemberRepository(prisma),
    );
    await expect(
      guard.canActivate({
        getHandler: () => null,
        getClass: () => null,
        switchToHttp: () => ({
          getRequest: () => ({
            user: {
              sub: user.id,
              role: user.role,
              farmerOnboardingRequired: true,
            },
            headers: { "x-farm-id": randomUUID() },
          }),
        }),
      } as any),
    ).rejects.toMatchObject({ errorCode: "FARM_ONBOARDING_REQUIRED" });
    const input = farm();
    const result = await onboard.complete(user.id, input);
    expect(result.required).toBe(false);
    expect(result.farms[0]).toMatchObject({
      ownerId: user.id,
      role: FarmRole.OWNER,
    });
    expect((await users.findById(user.id))!.farmerOnboardingRequired).toBe(
      false,
    );
    expect((await onboard.complete(user.id, input)).farms[0].id).toBe(
      result.farms[0].id,
    );
    expect(await prisma.farm.count({ where: { ownerId: user.id } })).toBe(1);
  });
  it("rolls back farm, membership and onboarding state after audit failure", async () => {
    const user = await create(UserRole.FARMER),
      spy = jest
        .spyOn(audit, "record")
        .mockRejectedValueOnce(new Error("Audit unavailable"));
    await expect(onboard.complete(user.id, farm())).rejects.toThrow(
      "Audit unavailable",
    );
    spy.mockRestore();
    expect(await prisma.farm.count({ where: { ownerId: user.id } })).toBe(0);
    expect((await users.findById(user.id))!.farmerOnboardingRequired).toBe(
      true,
    );
  });
  it("serializes staff quota, excludes the primary owner, and accepts existing memberships", async () => {
    const owner = await create(UserRole.FARMER),
      setup = await onboard.complete(owner.id, farm()),
      farmId = setup.farms[0]!.id,
      one = await create(UserRole.FARMER),
      two = await create(UserRole.FARMER);
    const results = await Promise.allSettled([
      members.addMember(farmId, { userId: one.id, role: FarmRole.MANAGER }, {
        sub: owner.id,
      } as any),
      members.addMember(farmId, { userId: two.id, role: FarmRole.OWNER }, {
        sub: owner.id,
      } as any),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.farmMember.count({ where: { farmId } })).toBe(2);
    const joined = (
      await prisma.farmMember.findMany({
        where: { farmId, userId: { not: owner.id } },
      })
    )[0]!;
    const status = await onboard.complete(joined.userId, {
      mode: "join",
      farmId,
      submissionKey: randomUUID(),
      confirmed: true,
    });
    expect(status.required).toBe(false);
    expect(status.farms[0]!.role).toBe(joined.role);
  });
  it("never creates memberships for arbitrary join IDs", async () => {
    const user = await create(UserRole.FARMER);
    await expect(
      onboard.complete(user.id, {
        mode: "join",
        farmId: randomUUID(),
        submissionKey: randomUUID(),
        confirmed: true,
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
  it("blocks normal admins and self changes in privilege management", async () => {
    const target = await create();
    const input = {
      action: "GRANT_ADMIN" as const,
      expectedRoleVersion: 0,
      reason: "Synthetic approval for testing.",
      actorPassword: password,
    };
    await expect(
      admin.change(reviewer.id, target.id, input),
    ).rejects.toMatchObject({ statusCode: 403 });
    await expect(
      admin.change(superAdmin.id, superAdmin.id, input),
    ).rejects.toMatchObject({ errorCode: "SELF_ROLE_CHANGE" });
  });
  it("grants and removes admin privilege with preserved fallback and revoked sessions", async () => {
    const user = await create(UserRole.BUYER),
      login = await auth.login({ email: user.email, password });
    expect((await admin.target(superAdmin.id, user.id)).fallbackRole).toBe(
      UserRole.BUYER,
    );
    expect(
      (await admin.targetByEmail(superAdmin.id, user.email)).fallbackRole,
    ).toBe(UserRole.BUYER);
    await admin.change(superAdmin.id, user.id, {
      action: "GRANT_ADMIN",
      expectedRoleVersion: 0,
      reason: "Synthetic promotion for testing.",
      actorPassword: password,
    });
    await expect(
      auth.refreshToken(login.tokens.refreshToken),
    ).rejects.toMatchObject({ statusCode: 401 });
    const restored = await admin.change(superAdmin.id, user.id, {
      action: "REMOVE_PRIVILEGE",
      expectedRoleVersion: 1,
      reason: "Synthetic demotion for testing.",
      actorPassword: password,
    });
    expect(restored.role).toBe(UserRole.BUYER);
    expect(restored.roleVersion).toBe(2);
  });
  it("serializes two super admins attempting to remove each other's authority", async () => {
    const first = await create(UserRole.SUPER_ADMIN),
      second = await create(UserRole.SUPER_ADMIN);
    const input = {
      action: "REMOVE_PRIVILEGE" as const,
      expectedRoleVersion: 0,
      reason: "Synthetic concurrent administrative removal.",
      actorPassword: password,
    };
    const results = await Promise.allSettled([
      admin.change(first.id, second.id, input),
      admin.change(second.id, first.id, input),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(
      [first.id, second.id].includes(
        (
          results.find(
            (r) => r.status === "fulfilled",
          ) as PromiseFulfilledResult<any>
        ).value.id,
      ),
    ).toBe(true);
    expect(
      await prisma.user.count({
        where: { id: { in: [first.id, second.id] }, role: "SUPER_ADMIN" },
      }),
    ).toBe(1);
  });
  it("commits refresh reuse invalidation so the newly issued token is unusable", async () => {
    const user = await create(),
      login = await auth.login({ email: user.email, password });
    const results = await Promise.allSettled([
      auth.refreshToken(login.tokens.refreshToken),
      auth.refreshToken(login.tokens.refreshToken),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const fresh: any = results.find((r) => r.status === "fulfilled");
    await expect(
      identities.resolve(
        await tokens.verifyAccessToken(fresh.value.tokens.accessToken),
      ),
    ).rejects.toMatchObject({ errorCode: "AUTHORIZATION_CHANGED" });
    expect(
      await prisma.refreshToken.count({
        where: { userId: user.id, revokedAt: null },
      }),
    ).toBe(0);
  });
  it("enforces a shared Redis limit", async () => {
    const key = randomUUID();
    await limiter.hit("test", key, 1, 60);
    await expect(limiter.hit("test", key, 1, 60)).rejects.toMatchObject({
      statusCode: 429,
    });
  });
  it("creates durable outbox and deduplicated delivery records", async () => {
    const user = await create(),
      request = await roleRequests.submit(user.id, application());
    const event = await prisma.roleNotificationOutbox.findUnique({
      where: { eventKey: `request-${request.id}-submitted` },
    });
    expect(event).not.toBeNull();
    const one = await events.delivery(event!.id, reviewer.id),
      two = await events.delivery(event!.id, reviewer.id);
    expect(one.id).toBe(two.id);
  });
});
