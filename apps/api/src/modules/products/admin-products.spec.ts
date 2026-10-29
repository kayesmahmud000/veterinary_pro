import { AdminProductsService, projectAdminProduct } from "./admin-products.service";
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
  it("projects actual course counts and only the explicitly public thumbnail", () => {
    const result = projectAdminProduct({ ...row, metadata: {courseThumbnailUrl:"https://images.example.test/course.jpg",privateNote:"DO-NOT-EXPOSE"}, _count:{courseLessons:4,courseEnrollments:8} } as any);
    expect(result).toHaveProperty("lessonCount",4);
    expect(result).toHaveProperty("enrollmentCount",8);
    expect(result).toHaveProperty("thumbnailUrl","https://images.example.test/course.jpg");
    expect(JSON.stringify(result)).not.toContain("DO-NOT-EXPOSE");
  });
  it("does not project malformed legacy thumbnail metadata", () => {
    expect(projectAdminProduct({...row,metadata:{courseThumbnailUrl:"javascript:alert(1)"}} as any)).toHaveProperty("thumbnailUrl",null);
  });
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
  it("allows pricing preparation on an unpublished YouTube draft", async () => {
    repo.lock.mockResolvedValue({...row,type:"VIDEO_COURSE",contentProvider:"YOUTUBE",priceCents:0});
    await expect(service.edit(claims,id,{expectedVersion:2,title:row.title,slug:row.slug,description:row.description,priceCents:1000,discountPriceCents:null,currency:"BDT",minSubscriptionTier:"STARTER" as any})).resolves.toBeDefined();
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
  it.each(["https://res.cloudinary.com/test/image/upload/v1/course-thumbnails/test.webp", "https://images.example.test/legacy.jpg", null])("preserves unrelated metadata while saving or removing thumbnail %s", async thumbnailUrl=>{
    repo.lock.mockResolvedValue({...row,metadata:{privateNote:"preserved",courseThumbnailUrl:"https://images.example.test/old.jpg"}});
    await service.edit(claims,id,{expectedVersion:2,title:row.title,slug:row.slug,description:row.description,priceCents:row.priceCents,discountPriceCents:null,currency:row.currency,minSubscriptionTier:row.minSubscriptionTier as any,thumbnailUrl});
    expect(repo.save).toHaveBeenCalledWith(id,expect.objectContaining({metadata:{privateNote:"preserved",adminManaged:true,courseThumbnailUrl:thumbnailUrl}}),tx);
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
