import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { bootstrapSuperAdmin, parseBootstrapInput } from "./bootstrap-super-admin.operation";

const targetId = "11111111-1111-4111-8111-111111111111";
const commonEnv = {
  ROLE_BOOTSTRAP_REASON: "Owner requested first administrative login",
  ROLE_BOOTSTRAP_CONFIRM: "BOOTSTRAP_FIRST_SUPER_ADMIN",
};
const newEnv = {
  ...commonEnv,
  ROLE_BOOTSTRAP_EMAIL: " Owner@Example.test ",
  ROLE_BOOTSTRAP_NAME: " Platform Owner ",
  ROLE_BOOTSTRAP_PASSWORD: "SyntheticOwnerPassword!123",
};
const account = {
  id: targetId,
  role: "LEARNER",
  status: "ACTIVE",
  deletedAt: null,
  previousNonAdministrativeRole: null,
  roleVersion: 0,
  authorizationVersion: 0,
};

function setup() {
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    user: {
      count: jest.fn().mockResolvedValue(0),
      findUnique: jest.fn().mockResolvedValue(account),
      create: jest.fn().mockResolvedValue(account),
      update: jest.fn().mockResolvedValue({ ...account, role: "SUPER_ADMIN" }),
    },
    roleUpgradeRequest: { count: jest.fn().mockResolvedValue(0) },
    refreshToken: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
    roleNotificationOutbox: { create: jest.fn().mockResolvedValue({}) },
  };
  const transaction = jest.fn(async (run: (client: typeof tx) => Promise<void>) => run(tx));
  return { tx, prisma: { $transaction: transaction } as unknown as PrismaClient };
}

describe("offline first super admin inputs", () => {
  it("normalizes new-account fields while preserving the password", () => {
    const parsed = parseBootstrapInput(newEnv);
    expect(parsed).toMatchObject({
      mode: "create", email: "owner@example.test", name: "Platform Owner",
      password: newEnv.ROLE_BOOTSTRAP_PASSWORD,
    });
  });

  it("retains UUID-only promotion", () => {
    expect(parseBootstrapInput({ ...commonEnv, ROLE_BOOTSTRAP_USER_ID: targetId }))
      .toMatchObject({ mode: "promote", target: targetId });
  });

  it.each([
    { ...newEnv, ROLE_BOOTSTRAP_USER_ID: targetId },
    { ...newEnv, ROLE_BOOTSTRAP_CONFIRM: "yes" },
    { ...newEnv, ROLE_BOOTSTRAP_PASSWORD: "short" },
    { ...newEnv, ROLE_BOOTSTRAP_PASSWORD: "a".repeat(73) },
    { ...newEnv, ROLE_BOOTSTRAP_PASSWORD: "\u00e9".repeat(37) },
    { ...newEnv, ROLE_BOOTSTRAP_EMAIL: "invalid" },
    { ...commonEnv },
  ])("refuses mixed/incomplete/invalid configuration %#", (env) => {
    expect(() => parseBootstrapInput(env)).toThrow();
  });
});

describe("offline first super admin operation", () => {
  it("creates a login-compatible hash and audited, versioned super admin", async () => {
    const { tx, prisma } = setup();
    tx.user.findUnique.mockResolvedValue(null);
    await bootstrapSuperAdmin(prisma, parseBootstrapInput(newEnv));
    const created = tx.user.create.mock.calls[0][0].data;
    expect(created).toMatchObject({ email: "owner@example.test", name: "Platform Owner", status: "ACTIVE" });
    expect(bcrypt.getRounds(created.passwordHash)).toBe(12);
    expect(await bcrypt.compare(newEnv.ROLE_BOOTSTRAP_PASSWORD, created.passwordHash)).toBe(true);
    expect(tx.user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: {
        role: "SUPER_ADMIN", previousNonAdministrativeRole: "LEARNER",
        roleVersion: { increment: 1 }, authorizationVersion: { increment: 1 },
      },
    }));
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      action: "SUPER_ADMIN_BOOTSTRAPPED", entityId: targetId,
    }) }));
    expect(tx.roleNotificationOutbox.create).toHaveBeenCalledWith({ data: {
      eventKey: `bootstrap-${targetId}-1`, eventType: "PRIVILEGED_ROLE_CHANGED",
      targetUserId: targetId, authorizationVersion: 1,
    } });
    expect(JSON.stringify(tx.auditLog.create.mock.calls)).not.toContain(newEnv.ROLE_BOOTSTRAP_PASSWORD);
    expect(JSON.stringify(tx.roleNotificationOutbox.create.mock.calls)).not.toContain(newEnv.ROLE_BOOTSTRAP_PASSWORD);
  });

  it("promotes an existing ADMIN without changing its password/fallback", async () => {
    const { tx, prisma } = setup();
    tx.user.findUnique.mockResolvedValue({ ...account, role: "ADMIN", previousNonAdministrativeRole: "VET" });
    await bootstrapSuperAdmin(prisma, parseBootstrapInput({ ...commonEnv, ROLE_BOOTSTRAP_USER_ID: targetId }));
    expect(tx.user.create).not.toHaveBeenCalled();
    expect(tx.user.update.mock.calls[0][0].data).toMatchObject({ previousNonAdministrativeRole: "VET" });
    expect(tx.user.update.mock.calls[0][0].data).not.toHaveProperty("passwordHash");
    expect(tx.refreshToken.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: targetId, revokedAt: null },
    }));
  });

  it("refuses any second active super admin before account mutation", async () => {
    const { tx, prisma } = setup();
    tx.user.count.mockResolvedValue(1);
    await expect(bootstrapSuperAdmin(prisma, parseBootstrapInput(newEnv))).rejects.toThrow("already exists");
    expect(tx.user.create).not.toHaveBeenCalled();
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it("refuses an existing email, including a deleted account, without replacing credentials", async () => {
    const { tx, prisma } = setup();
    tx.user.findUnique.mockResolvedValue({ ...account, deletedAt: new Date() });
    await expect(bootstrapSuperAdmin(prisma, parseBootstrapInput(newEnv))).rejects.toThrow("Email already exists");
    expect(tx.user.create).not.toHaveBeenCalled();
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it.each([null, { ...account, status: "SUSPENDED" }, { ...account, deletedAt: new Date() }])(
    "refuses ineligible promotion %#", async (user) => {
      const { tx, prisma } = setup();
      tx.user.findUnique.mockResolvedValue(user);
      await expect(bootstrapSuperAdmin(prisma, parseBootstrapInput({ ...commonEnv, ROLE_BOOTSTRAP_USER_ID: targetId })))
        .rejects.toThrow("active account");
      expect(tx.user.update).not.toHaveBeenCalled();
    },
  );

  it("requires pending applications to be resolved before promotion", async () => {
    const { tx, prisma } = setup();
    tx.roleUpgradeRequest.count.mockResolvedValue(1);
    await expect(bootstrapSuperAdmin(prisma, parseBootstrapInput({ ...commonEnv, ROLE_BOOTSTRAP_USER_ID: targetId })))
      .rejects.toThrow("Resolve the target application");
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it("propagates an outbox failure to the transaction instead of reporting success", async () => {
    const { tx, prisma } = setup();
    tx.roleNotificationOutbox.create.mockRejectedValue(new Error("outbox unavailable"));
    await expect(bootstrapSuperAdmin(prisma, parseBootstrapInput({ ...commonEnv, ROLE_BOOTSTRAP_USER_ID: targetId })))
      .rejects.toThrow("outbox unavailable");
  });
});
