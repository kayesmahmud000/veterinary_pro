import { Prisma } from "@prisma/client";
import { ProductType, SubscriptionTier } from "@vetralink/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { ProductEntity } from "../entities/product.entity";
import { ProductRepository } from "./product.repository";
import { EntityConflictException } from "../../../common/exceptions/domain.exception";

describe("ProductRepository", () => {
  let repository: ProductRepository;
  let prisma: jest.Mocked<PrismaService>;

  const mockDbRow = {
    id: "11111111-1111-1111-1111-111111111111",
    title: "Bovine Mastitis Protocol",
    slug: "bovine-mastitis-protocol",
    type: ProductType.VIDEO_COURSE,
    description: "Detailed video clinical protocol on dairy cow mastitis management.",
    priceCents: 5000,
    discountPriceCents: 4000,
    currency: "USD",
    contentS3Key: "courses/mastitis-v1/master.mp4",
    minSubscriptionTier: SubscriptionTier.STARTER,
    isPublished: true,
    metadata: { durationMinutes: 120 },
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockEntity = ProductEntity.reconstitute(mockDbRow);

  beforeEach(() => {
    prisma = {
      product: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
    } as unknown as jest.Mocked<PrismaService>;

    repository = new ProductRepository(prisma);
  });

  describe("create", () => {
    it("should insert record and return ProductEntity", async () => {
      (prisma.product.create as jest.Mock).mockResolvedValueOnce(mockDbRow);

      const result = await repository.create(mockEntity);

      expect(prisma.product.create).toHaveBeenCalled();
      expect(result.id).toBe(mockEntity.id);
      expect(result.slug).toBe(mockEntity.slug);
    });

    it("should throw EntityConflictException when slug violates unique constraint (P2002)", async () => {
      const p2002Error = new Prisma.PrismaClientKnownRequestError(
        "Unique constraint failed",
        {
          code: "P2002",
          clientVersion: "5.19.1",
        }
      );
      (prisma.product.create as jest.Mock).mockRejectedValueOnce(p2002Error);

      await expect(repository.create(mockEntity)).rejects.toThrow(
        EntityConflictException
      );
    });
  });

  describe("findById", () => {
    it("should return ProductEntity if found and not deleted", async () => {
      (prisma.product.findFirst as jest.Mock).mockResolvedValueOnce(mockDbRow);

      const result = await repository.findById(mockEntity.id);

      expect(prisma.product.findFirst).toHaveBeenCalledWith({
        where: { id: mockEntity.id, deletedAt: null },
      });
      expect(result).not.toBeNull();
      expect(result?.id).toBe(mockEntity.id);
    });

    it("should return null if product not found", async () => {
      (prisma.product.findFirst as jest.Mock).mockResolvedValueOnce(null);

      const result = await repository.findById("non-existent-id");
      expect(result).toBeNull();
    });
  });

  describe("findBySlug", () => {
    it("should return ProductEntity by slug", async () => {
      (prisma.product.findFirst as jest.Mock).mockResolvedValueOnce(mockDbRow);

      const result = await repository.findBySlug(mockEntity.slug);

      expect(prisma.product.findFirst).toHaveBeenCalledWith({
        where: { slug: mockEntity.slug, deletedAt: null },
      });
      expect(result?.slug).toBe(mockEntity.slug);
    });
  });

  describe("findMany", () => {
    it("should return list of products and total count", async () => {
      (prisma.product.findMany as jest.Mock).mockResolvedValueOnce([mockDbRow]);
      (prisma.product.count as jest.Mock).mockResolvedValueOnce(1);

      const result = await repository.findMany({
        type: ProductType.VIDEO_COURSE,
        isPublished: true,
        skip: 0,
        take: 10,
      });

      expect(result.products.length).toBe(1);
      expect(result.total).toBe(1);
    });
  });

  describe("update", () => {
    it("should update and return reconstituted entity", async () => {
      (prisma.product.update as jest.Mock).mockResolvedValueOnce({
        ...mockDbRow,
        title: "Updated Title",
      });

      const result = await repository.update(mockEntity);
      expect(result.title).toBe("Updated Title");
    });
  });

  describe("softDelete", () => {
    it("should set deletedAt timestamp", async () => {
      (prisma.product.update as jest.Mock).mockResolvedValueOnce(mockDbRow);

      await repository.softDelete(mockEntity.id);

      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: mockEntity.id },
        data: {
          deletedAt: expect.any(Date),
          updatedAt: expect.any(Date),
        },
      });
    });
  });

  describe("existsBySlug", () => {
    it("should return true if count > 0", async () => {
      (prisma.product.count as jest.Mock).mockResolvedValueOnce(1);

      const exists = await repository.existsBySlug("existing-slug");
      expect(exists).toBe(true);
    });

    it("should return false if count === 0", async () => {
      (prisma.product.count as jest.Mock).mockResolvedValueOnce(0);

      const exists = await repository.existsBySlug("available-slug");
      expect(exists).toBe(false);
    });
  });
});
