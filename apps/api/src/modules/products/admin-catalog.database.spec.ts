import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";
import { AdminProductsRepository } from "./admin-products.repository";
import { AdminProductsService } from "./admin-products.service";
import { ProductRepository } from "./repositories/product.repository";
import { UserRepository } from "../users/repositories/user.repository";
import { AuditLogRepository } from "../audit/repositories/audit-log.repository";
import { TransactionManager } from "../prisma/transaction/transaction.manager";
import { PrismaService } from "../prisma/prisma.service";
import { AdminMediaRepository } from "../media/admin-media.repository";
import { AdminMediaService } from "../media/admin-media.service";
import {
  JwtPayload,
  UserRole,
  ProductType,
  SubscriptionTier,
} from "@vetralink/shared-types";
// Explicit disposable opt-in only; never load/reset the configured project database.
const database = process.env.ADM3_TEST_DATABASE_URL;
if (database && !new URL(database).pathname.endsWith("adm3_test"))
  throw new Error(
    "ADM3_TEST_DATABASE_URL must name an explicit adm3_test database.",
  );
const live = database ? describe : describe.skip;
live("ADM-3 against disposable PostgreSQL with controlled storage", () => {
  let prisma: PrismaClient,
    catalog: AdminProductsService,
    media: AdminMediaService,
    claims: JwtPayload,
    other: JwtPayload,
    transactions: TransactionManager,
    audit: AuditLogRepository,
    users: UserRepository,
    repo: AdminProductsRepository;
  const objects = new Map<string, { size: number; contentType: string }>(),
    remote = new Set<string>();
  const input = (slug = `synthetic-${randomUUID()}`) => ({
    title: "Synthetic database product",
    slug,
    type: ProductType.EBOOK,
    description: "Synthetic database integration description.",
    priceCents: 2000,
    discountPriceCents: null,
    currency: "BDT",
    minSubscriptionTier: SubscriptionTier.STARTER,
  });
  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: database } } });
    await prisma.$connect();
    const adapter = prisma as unknown as PrismaService;
    users = new UserRepository(adapter, {} as never);
    audit = new AuditLogRepository(adapter);
    transactions = new TransactionManager(adapter);
    repo = new AdminProductsRepository(adapter);
    catalog = new AdminProductsService(repo, users, transactions, audit);
    const a = await prisma.user.create({
        data: {
          name: "Synthetic Admin",
          email: `${randomUUID()}@adm3.example.test`,
          passwordHash: "synthetic-test-hash",
          role: "ADMIN",
        },
      }),
      b = await prisma.user.create({
        data: {
          name: "Other Admin",
          email: `${randomUUID()}@adm3.example.test`,
          passwordHash: "synthetic-test-hash",
          role: "ADMIN",
        },
      });
    claims = {
      sub: a.id,
      role: UserRole.ADMIN,
      authorizationVersion: 0,
    } as JwtPayload;
    other = {
      sub: b.id,
      role: UserRole.ADMIN,
      authorizationVersion: 0,
    } as JwtPayload;
    const storage = {
      createMultipartUpload: async (_bucket: string, key: string) => {
        remote.add(key);
        return "synthetic-provider-id";
      },
      statObject: async (_bucket: string, key: string) =>
        objects.get(key) ?? null,
      completeMultipartUpload: async (_bucket: string, key: string) => {
        objects.set(key, { size: 20, contentType: "application/pdf" });
        return { location: "synthetic" };
      },
      abortMultipartUpload: async (_bucket: string, key: string) => {
        if (!remote.delete(key))
          throw Object.assign(new Error("already absent"), {
            name: "NoSuchUpload",
          });
      },
    };
    media = new AdminMediaService(
      new AdminMediaRepository(adapter),
      storage as never,
      { getJob: async () => null } as never,
      { s3BucketMedia: "synthetic" } as never,
      catalog,
      transactions,
      audit,
    );
  });
  afterAll(async () => {
    await prisma?.$disconnect();
  });
  it("preserves a pre-migration populated product with default version zero", async () => {
    const existing = await prisma.product.findUnique({
      where: { slug: "adm3-populated-rehearsal" },
    });
    expect(existing?.title).toBe("Existing pre-migration product");
    expect(existing?.version).toBe(0);
    expect(existing?.contentS3Key).toBe("legacy/guide.pdf");
  });
  it("allows one concurrent edit, rejects the stale writer and commits one audit", async () => {
    const p = await catalog.create(claims, input());
    const fields = {
      title: p.title,
      slug: p.slug,
      description: p.description,
      priceCents: 3000,
      discountPriceCents: null,
      currency: p.currency,
      minSubscriptionTier: p.minSubscriptionTier,
      expectedVersion: 0,
    };
    const results = await Promise.allSettled([
      catalog.edit(claims, p.id, fields),
      catalog.edit(claims, p.id, {
        ...fields,
        title: "Competing product title",
      }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
    expect(
      (await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).version,
    ).toBe(1);
    expect(
      await prisma.auditLog.count({
        where: { entityId: p.id, action: "PRODUCT_UPDATED" },
      }),
    ).toBe(1);
  });
  it("rolls product persistence back when audit fails", async () => {
    const broken = new AdminProductsService(repo, users, transactions, {
        record: async () => {
          throw new Error("synthetic audit failure");
        },
      } as never),
      data = input();
    await expect(broken.create(claims, data)).rejects.toThrow(
      "synthetic audit failure",
    );
    expect(await prisma.product.count({ where: { slug: data.slug } })).toBe(0);
  });
  it("prevents an in-flight legacy snapshot from erasing newly managed state", async () => {
    const raw = await prisma.product.create({
        data: { ...input(), contentS3Key: "legacy/file.pdf" },
      }),
      legacy = new ProductRepository(prisma as unknown as PrismaService),
      old = (await legacy.findById(raw.id))!;
    await catalog.edit(claims, raw.id, {
      title: raw.title,
      slug: raw.slug,
      description: raw.description,
      priceCents: 2500,
      discountPriceCents: null,
      currency: raw.currency,
      minSubscriptionTier: SubscriptionTier.STARTER,
      expectedVersion: 0,
    });
    old.updateDetails({ title: "Stale legacy title" });
    await expect(legacy.update(old)).rejects.toThrow("Product changed");
    expect(
      (await prisma.product.findUniqueOrThrow({ where: { id: raw.id } }))
        .metadata,
    ).toEqual({ adminManaged: true });
  });
  it("persists owned upload recovery, attachment and publication with real audit transactions", async () => {
    const p = await catalog.create(claims, input()),
      id = randomUUID(),
      session = await media.initiate(claims, {
        requestId: id,
        productId: p.id,
        filename: "guide.pdf",
        contentType: "application/pdf",
        fileSizeBytes: 20,
      });
    expect(session.state).toBe("UPLOADING");
    await expect(media.part(other, id, { partNumber: 1 })).rejects.toThrow();
    const completed = await media.complete(claims, id, {
      parts: [{ partNumber: 1, etag: "synthetic" }],
    });
    expect(completed.state).toBe("UPLOADED");
    const attached = await media.attach(claims, p.id, {
      uploadId: id,
      expectedVersion: completed.product.version,
    });
    expect(attached.contentS3Key).toBe(`admin-assets/${p.id}/${id}.pdf`);
    const published = await catalog.action(claims, p.id, {
      action: "PUBLISH",
      expectedVersion: attached.version,
      reason: "Publish verified synthetic file",
    });
    expect(published.isPublished).toBe(true);
    expect(
      await prisma.auditLog.count({
        where: { entityId: id, action: "MEDIA_UPLOAD_COMPLETED" },
      }),
    ).toBe(1);
  });
  it("recovers abort after provider success and a database/audit rollback", async () => {
    const p = await catalog.create(claims, input()),
      id = randomUUID();
    await media.initiate(claims, {
      requestId: id,
      productId: p.id,
      filename: "abort.pdf",
      contentType: "application/pdf",
      fileSizeBytes: 20,
    });
    const spy = jest
      .spyOn(audit, "record")
      .mockRejectedValueOnce(new Error("synthetic audit rollback"));
    await expect(media.abort(claims, id)).rejects.toThrow(
      "synthetic audit rollback",
    );
    expect(
      (await prisma.adminMediaUpload.findUniqueOrThrow({ where: { id } }))
        .state,
    ).toBe("UPLOADING");
    spy.mockRestore();
    const result = await media.abort(claims, id);
    expect(result.state).toBe("ABORTED");
  });
});
