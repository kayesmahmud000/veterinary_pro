import {
  billingQueries,
  billingPlanEditSchema,
  billingSubscriptionActionSchema,
  JwtPayload,
  UserRole,
  UserStatus,
} from "@vetralink/shared-types";
import { UserEntity } from "../users/entities/user.entity";
import { BillingService } from "./billing.service";
import { BillingController } from "./billing.controller";
import { ROLES_KEY } from "../../common/decorators/roles.decorator";
const id = "550e8400-e29b-41d4-a716-446655440001";
const claims = {
  sub: id,
  role: UserRole.ADMIN,
  authorizationVersion: 2,
} as JwtPayload;
function actor(role = UserRole.ADMIN, status = UserStatus.ACTIVE, version = 2) {
  return UserEntity.reconstitute({
    id,
    role,
    status,
    authorizationVersion: version,
    email: "synthetic@example.test",
    name: "Synthetic",
    phone: null,
    phoneHash: null,
    passwordHash: "hash",
    avatarUrl: null,
    isEmailVerified: false,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  });
}
describe("Administrative billing boundaries", () => {
  let service: BillingService,
    repo: any,
    users: any,
    passwords: any,
    audit: any,
    limiter: any,
    current: UserEntity;
  const tx = { marker: "atomic" };
  const row = {
    kind: "subscriptions",
    id,
    revision: "a".repeat(64),
    allowedActions: ["SCHEDULE_CANCELLATION"],
    cancelAtPeriodEnd: false,
  };
  const input = {
    expectedRevision: row.revision,
    action: "SCHEDULE_CANCELLATION" as const,
    reason: "Reviewed support request",
    actorPassword: "synthetic password",
  };
  beforeEach(() => {
    current = actor();
    repo = {
      list: jest.fn(async () => ({ items: [], nextCursor: null })),
      detail: jest.fn(async () => row),
      lock: jest.fn(),
      schedule: jest.fn(),
      editPlan: jest.fn(),
    };
    users = {
      findById: jest.fn(async () => current),
      lockById: jest.fn(async () => current),
    };
    passwords = { compare: jest.fn(async () => true) };
    audit = { record: jest.fn() };
    limiter = { hit: jest.fn() };
    service = new BillingService(
      repo,
      users,
      passwords,
      { run: async (fn: any) => fn(tx) } as any,
      audit,
      limiter,
    );
  });
  it("registers both authentication and role guards with an exact admin allowlist", () => {
    expect(Reflect.getMetadata(ROLES_KEY, BillingController)).toEqual([
      UserRole.ADMIN,
      UserRole.SUPER_ADMIN,
    ]);
    expect(
      Reflect.getMetadata("__guards__", BillingController).map(
        (g: any) => g.name,
      ),
    ).toEqual(["JwtAuthGuard", "RolesGuard"]);
  });
  for (const role of [
    UserRole.LEARNER,
    UserRole.FARMER,
    UserRole.VET,
    UserRole.BUYER,
  ])
    it(`denies current ${role} even with stale administrative claims`, async () => {
      current = actor(role);
      await expect(
        service.list(claims, "orders", { limit: 20 }),
      ).rejects.toThrow();
      await expect(service.action(claims, id, input)).rejects.toThrow();
      expect(repo.list).not.toHaveBeenCalled();
      expect(repo.schedule).not.toHaveBeenCalled();
    });
  it.each([UserStatus.SUSPENDED, UserStatus.PENDING_VERIFICATION])(
    "denies %s identities",
    async (status) => {
      current = actor(UserRole.ADMIN, status);
      await expect(service.detail(claims, "plans", id)).rejects.toThrow();
    },
  );
  it("denies revoked authorization versions", async () => {
    current = actor(UserRole.ADMIN, UserStatus.ACTIVE, 3);
    await expect(
      service.list(claims, "orders", { limit: 20 }),
    ).rejects.toThrow();
  });
  it("requires a correct password before starting a write", async () => {
    passwords.compare.mockResolvedValue(false);
    await expect(service.action(claims, id, input)).rejects.toMatchObject({
      errorCode: "PASSWORD_CONFIRMATION_FAILED",
    });
    expect(repo.lock).not.toHaveBeenCalled();
  });
  it("fails closed when the workflow limiter is unavailable", async () => {
    limiter.hit.mockRejectedValue(new Error("offline"));
    await expect(service.action(claims, id, input)).rejects.toThrow();
    expect(repo.lock).not.toHaveBeenCalled();
  });
  it("rechecks the actor after locking", async () => {
    users.lockById.mockResolvedValue(actor(UserRole.LEARNER));
    await expect(service.action(claims, id, input)).rejects.toThrow();
    expect(repo.schedule).not.toHaveBeenCalled();
  });
  it("rejects stale writes before mutation/audit", async () => {
    await expect(
      service.action(claims, id, {
        ...input,
        expectedRevision: "b".repeat(64),
      }),
    ).rejects.toMatchObject({ errorCode: "BILLING_VERSION_CONFLICT" });
    expect(repo.schedule).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });
  it("rejects provider-managed or otherwise unsupported transitions", async () => {
    repo.detail.mockResolvedValue({ ...row, allowedActions: [] });
    await expect(service.action(claims, id, input)).rejects.toMatchObject({
      errorCode: "BILLING_ACTION_UNAVAILABLE",
    });
    expect(repo.schedule).not.toHaveBeenCalled();
  });
  it("shares actor lock, mutation and secret-free audit transaction", async () => {
    await service.action(claims, id, input);
    expect(users.lockById).toHaveBeenCalledWith(id, tx);
    expect(repo.schedule).toHaveBeenCalledWith(id, true, tx);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "SUBSCRIPTION_CANCELLATION_SCHEDULED",
        newValues: { cancelAtPeriodEnd: true, reason: input.reason },
      }),
      tx,
    );
    expect(JSON.stringify(audit.record.mock.calls)).not.toContain(
      input.actorPassword,
    );
  });
  it("bounds and separates queries/actions", () => {
    expect(billingQueries.orders.safeParse({ limit: 101 }).success).toBe(false);
    expect(billingQueries.orders.safeParse({ status: "ACTIVE" }).success).toBe(
      false,
    );
    expect(billingQueries.plans.safeParse({ subscriptionId: id }).success).toBe(
      false,
    );
    expect(
      billingSubscriptionActionSchema.safeParse({ ...input, action: "REFUND" })
        .success,
    ).toBe(false);
    expect(
      billingPlanEditSchema.safeParse({
        ...input,
        name: "Plan",
        priceMonthlyCents: 1.5,
        priceAnnualCents: 1,
        maxAnimals: 2,
        isActive: true,
      }).success,
    ).toBe(false);
  });
});
