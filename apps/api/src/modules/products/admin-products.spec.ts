import { AdminProductsService } from "./admin-products.service";
import { UserEntity } from "../users/entities/user.entity";
import { UserRole, UserStatus, JwtPayload } from "@vetralink/shared-types";
const actorId = "550e8400-e29b-41d4-a716-446655440001",
  id = "550e8400-e29b-41d4-a716-446655440002";
const actor = () =>
  UserEntity.create({
    id: actorId,
    name: "Synthetic admin",
    email: "admin@example.test",
    passwordHash: "hash",
    role: UserRole.ADMIN,
  });
const claims = {
  sub: actorId,
  role: UserRole.ADMIN,
  authorizationVersion: 0,
} as JwtPayload;
const row = {
  id,
  version: 2,
  title: "Synthetic product",
  slug: "synthetic-product",
  type: "EBOOK",
  description: "Synthetic description",
  priceCents: 1000,
  discountPriceCents: null,
  currency: "USD",
  minSubscriptionTier: "STARTER",
  contentS3Key: "",
  isPublished: false,
  metadata: {},
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};
describe("Admin product policy", () => {
  let service: AdminProductsService, repo: any, users: any, audit: any;
  const tx = { marker: "tx" };
  beforeEach(() => {
    repo = {
      lock: jest.fn(async () => ({ ...row })),
      detail: jest.fn(async () => ({ ...row })),
      list: jest.fn(async () => ({ items: [], nextCursor: null })),
      save: jest.fn(async (_id, data) => ({ ...row, ...data, version: 3 })),
    };
    users = {
      findById: jest.fn(async () => actor()),
      lockById: jest.fn(async () => actor()),
    };
    audit = { record: jest.fn() };
    service = new AdminProductsService(
      repo,
      users,
      { run: async (fn: any) => fn(tx) } as any,
      audit,
    );
  });
  it("refuses publication without an attached asset", async () => {
    await expect(
      service.action(claims, id, {
        action: "PUBLISH",
        expectedVersion: 2,
        reason: "Publish reviewed product",
      }),
    ).rejects.toThrow();
    expect(repo.save).not.toHaveBeenCalled();
  });
  it("rejects stale versions before product persistence", async () => {
    await expect(
      service.action(claims, id, {
        action: "DELETE",
        expectedVersion: 1,
        reason: "Delete obsolete product",
      }),
    ).rejects.toThrow();
    expect(repo.save).not.toHaveBeenCalled();
  });
  it("soft deletes and audits through one transaction", async () => {
    await service.action(claims, id, {
      action: "DELETE",
      expectedVersion: 2,
      reason: "Delete obsolete product",
    });
    expect(repo.save).toHaveBeenCalledWith(
      id,
      expect.objectContaining({
        deletedAt: expect.any(Date),
        isPublished: false,
      }),
      tx,
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "PRODUCT_DELETED", entityId: id }),
      tx,
    );
  });
  it("checks current active admin for reads and rechecks locked identity for writes", async () => {
    users.findById.mockResolvedValue(
      UserEntity.create({
        id: actorId,
        name: "Learner",
        email: "learner@example.test",
        passwordHash: "hash",
      }),
    );
    await expect(service.list(claims, { limit: 20 })).rejects.toThrow();
    expect(repo.list).not.toHaveBeenCalled();
    users.findById.mockResolvedValue(actor());
    users.lockById.mockResolvedValue(
      UserEntity.create({
        id: actorId,
        name: "Suspended",
        email: "admin@example.test",
        passwordHash: "hash",
        role: UserRole.ADMIN,
        status: UserStatus.SUSPENDED,
      }),
    );
    await expect(
      service.action(claims, id, {
        action: "DELETE",
        expectedVersion: 2,
        reason: "Delete obsolete product",
      }),
    ).rejects.toThrow();
  });
});
