import { UserRole, UserStatus, JwtPayload } from "@vetralink/shared-types";
import { UserEntity } from "../users/entities/user.entity";
import { DirectoryService } from "./directory.service";
import { DirectoryRepository } from "./directory.repository";
const actorId = "550e8400-e29b-41d4-a716-446655440001";
const targetId = "550e8400-e29b-41d4-a716-446655440002";
function entity(
  id: string,
  role = UserRole.LEARNER,
  status = UserStatus.ACTIVE,
  version = 2,
) {
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
describe("DirectoryService policy and atomic actions", () => {
  let service: DirectoryService,
    users: any,
    directory: any,
    audit: any,
    refresh: any,
    passwords: any;
  let actor: UserEntity, target: UserEntity;
  const tx = { marker: "same transaction" };
  const claims = {
    sub: actorId,
    role: UserRole.ADMIN,
    authorizationVersion: 2,
  } as JwtPayload;
  const input = {
    action: "SUSPEND",
    expectedAuthorizationVersion: 2,
    reason: "Support investigation",
    actorPassword: "password",
  } as const;
  beforeEach(() => {
    actor = entity(actorId, UserRole.ADMIN);
    target = entity(targetId);
    users = {
      findById: jest.fn(async (id) => (id === actorId ? actor : target)),
      lockById: jest.fn(async (id) => (id === actorId ? actor : target)),
      lockAdministrativePolicy: jest.fn(),
    };
    directory = {
      action: jest.fn(async () => ({ id: targetId })),
      list: jest.fn(async () => ({ items: [], nextCursor: null })),
      detail: jest.fn(async () => null),
    };
    audit = { record: jest.fn() };
    refresh = { revokeAllForUser: jest.fn() };
    passwords = { compare: jest.fn(async () => true) };
    service = new DirectoryService(
      directory,
      users,
      passwords,
      refresh,
      { run: async (fn: any) => fn(tx) } as any,
      audit,
      { hit: jest.fn() } as any,
    );
  });
  it("commits status, version, refresh revocation and audit in the same transaction", async () => {
    await service.act(claims, targetId, input);
    expect(directory.action).toHaveBeenCalledWith(targetId, "SUSPENDED", 2, tx);
    expect(refresh.revokeAllForUser).toHaveBeenCalledWith(
      targetId,
      expect.any(Date),
      tx,
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "USER_SUSPENDED",
        newValues: {
          status: "SUSPENDED",
          authorizationVersion: 3,
          reason: "Support investigation",
        },
      }),
      tx,
    );
  });
  it.each([UserRole.LEARNER, UserRole.VET, UserRole.FARMER, UserRole.BUYER])(
    "denies %s before directory reads",
    async (role) => {
      actor = entity(actorId, role);
      await expect(
        service.list(claims, "users", { limit: 20 }),
      ).rejects.toThrow();
      expect(directory.list).not.toHaveBeenCalled();
    },
  );
  it.each([UserRole.ADMIN, UserRole.SUPER_ADMIN])(
    "protects administrative target %s including last Super",
    async (role) => {
      target = entity(targetId, role);
      await expect(service.act(claims, targetId, input)).rejects.toThrow();
      expect(directory.action).not.toHaveBeenCalled();
    },
  );
  it("rejects stale expected version", async () => {
    await expect(
      service.act(claims, targetId, {
        ...input,
        expectedAuthorizationVersion: 1,
      }),
    ).rejects.toThrow();
    expect(directory.action).not.toHaveBeenCalled();
  });
  it("rejects no-op and pending verification transitions", async () => {
    target = entity(targetId, UserRole.LEARNER, UserStatus.SUSPENDED);
    await expect(service.act(claims, targetId, input)).rejects.toThrow();
    target = entity(
      targetId,
      UserRole.LEARNER,
      UserStatus.PENDING_VERIFICATION,
    );
    await expect(service.act(claims, targetId, input)).rejects.toThrow();
  });
  it("rejects self actions and wrong password", async () => {
    await expect(service.act(claims, actorId, input)).rejects.toThrow();
    passwords.compare.mockResolvedValue(false);
    await expect(service.act(claims, targetId, input)).rejects.toThrow();
    expect(directory.action).not.toHaveBeenCalled();
  });
  it("rechecks current actor version under lock", async () => {
    users.lockById.mockImplementation(async (id: string) =>
      id === actorId
        ? entity(actorId, UserRole.ADMIN, UserStatus.ACTIVE, 3)
        : target,
    );
    await expect(service.act(claims, targetId, input)).rejects.toThrow();
    expect(directory.action).not.toHaveBeenCalled();
  });
  it("revokes active sessions without changing status and increments the version", async () => {
    await service.act(claims, targetId, {
      ...input,
      action: "REVOKE_SESSIONS",
    });
    expect(directory.action).toHaveBeenCalledWith(targetId, "ACTIVE", 2, tx);
  });
});
describe("DirectoryRepository projections and visibility", () => {
  it("filters unknown/privileged audit events before pagination for ADMIN", async () => {
    const prisma = { auditLog: { findMany: jest.fn(async () => []) } };
    await new DirectoryRepository(prisma as any).list(
      "audit",
      { limit: 20 },
      false,
    );
    const args = prisma.auditLog.findMany.mock.calls[0] as any;
    expect(args[0].where.action.in).toContain("USER_SUSPENDED");
    expect(args[0].where.action.in).not.toContain("PRIVILEGED_ROLE_CHANGED");
    expect(args[0].take).toBe(21);
  });
  it("returns only allowlisted scalar audit snapshots", async () => {
    const row = {
      id: targetId,
      userId: actorId,
      action: "USER_SUSPENDED",
      entityType: "User",
      entityId: targetId,
      traceId: targetId,
      createdAt: new Date("2026-10-14T00:00:00Z"),
      oldValues: {
        status: "ACTIVE",
        email: "secret",
        nested: { token: "secret" },
      },
      newValues: {
        status: "SUSPENDED",
        password: "secret",
        reason: "Support investigation",
      },
      ipAddress: "secret",
    };
    const repo = new DirectoryRepository({
      auditLog: { findFirst: async () => row },
    } as any);
    const result = await repo.detail("audit", targetId, false);
    expect(result).toEqual({
      id: targetId,
      actorId,
      action: "USER_SUSPENDED",
      entityType: "User",
      entityId: targetId,
      traceId: targetId,
      createdAt: "2026-10-14T00:00:00.000Z",
      oldValues: { status: "ACTIVE" },
      newValues: { status: "SUSPENDED", reason: "Support investigation" },
    });
  });
  it("uses id>cursor, stable ordering and minimal fields for user lists", async () => {
    const prisma = { user: { findMany: jest.fn(async () => []) } };
    await new DirectoryRepository(prisma as any).list(
      "users",
      { limit: 20, cursor: targetId, search: "Test" },
      false,
    );
    const args = prisma.user.findMany.mock.calls[0] as any;
    expect(args[0].where.id).toEqual({ gt: targetId });
    expect(args[0].orderBy).toEqual({ id: "asc" });
    expect(args[0].select.passwordHash).toBeUndefined();
    expect(args[0].select.phone).toBeUndefined();
  });
});

describe("Farm support counts", () => {
  it("counts only active undeleted animals rather than sold or deceased records", async () => {
    const prisma = { farm: { findFirst: jest.fn(async () => null) } };
    await new DirectoryRepository(prisma as any).detail(
      "farms",
      targetId,
      false,
    );
    const args = prisma.farm.findFirst.mock.calls[0] as any;
    expect(args[0].select._count.select.animals.where).toEqual({
      deletedAt: null,
      status: "ACTIVE",
    });
  });
});
describe("Deleted owner privacy", () => {
  it("redacts deleted owners in both farm list and detail without hiding the farm", async () => {
    const farm = {
      id: targetId,
      name: "Synthetic farm",
      farmType: "DAIRY",
      country: "Bangladesh",
      createdAt: new Date("2026-10-14T00:00:00Z"),
      owner: {
        id: actorId,
        name: "Deleted owner secret",
        deletedAt: new Date(),
      },
    };
    const repo = new DirectoryRepository({
      farm: {
        findMany: async () => [farm],
        findFirst: async () => ({
          ...farm,
          members: [],
          _count: { members: 0, animals: 0 },
          subscriptions: [],
        }),
      },
    } as any);
    const list = await repo.list("farms", { limit: 20 }, false);
    expect((list.items[0] as any).owner).toBeNull();
    expect(
      ((await repo.detail("farms", targetId, false)) as any).owner,
    ).toBeNull();
  });
});

describe("Known operational audit reasons", () => {
  it.each([
    "USER_SUSPENDED", "USER_REACTIVATED", "USER_SESSIONS_REVOKED",
    "SUBSCRIPTION_CANCELLATION_SCHEDULED", "SUBSCRIPTION_CANCELLATION_REVOKED", "SUBSCRIPTION_PLAN_UPDATED",
    "CONSULTATION_ADMIN_ASSIGNED", "CONSULTATION_ADMIN_AUTO_ASSIGNED", "CONSULTATION_ADMIN_CANCELLED",
  ])("preserves only the safe reason for %s", async action => {
    const repo = new DirectoryRepository({auditLog:{findFirst:async()=>({
      id:targetId,userId:actorId,action,entityType:"Consultation",entityId:targetId,traceId:targetId,
      createdAt:new Date("2026-10-16T00:00:00Z"),oldValues:null,
      newValues:{reason:"Reviewed support request",actorPassword:"PRIVATE-PASSWORD",providerError:"PRIVATE-PROVIDER"},
    })}} as any);
    const row = await repo.detail("audit",targetId,false);
    expect((row as any).newValues).toEqual({reason:"Reviewed support request"});
    expect(JSON.stringify(row)).not.toContain("PRIVATE-");
  });
});
