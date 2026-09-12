import { ProductType, SubscriptionTier } from "@vetralink/shared-types";
import { ProductsService } from "./products.service";
import { IProductRepository } from "../repositories/product.repository.interface";
import { IAuditLogRepository } from "../../audit/repositories/audit-log.repository.interface";
import { ITransactionManager } from "../../prisma/interfaces/transaction.interface";
import { ProductEntity } from "../entities/product.entity";
import {
  EntityConflictException,
  EntityNotFoundException,
} from "../../../common/exceptions/domain.exception";

describe("ProductsService", () => {
  let service: ProductsService;
  let productRepository: jest.Mocked<IProductRepository>;
  let auditLogRepository: jest.Mocked<IAuditLogRepository>;
  let transactionManager: jest.Mocked<ITransactionManager>;

  const mockProductProps = {
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

  const mockProductEntity = ProductEntity.reconstitute(mockProductProps);

  beforeEach(() => {
    productRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findBySlug: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
      existsBySlug: jest.fn(),
    };

    auditLogRepository = {
      record: jest.fn(),
      findByEntity: jest.fn(),
      findByTraceId: jest.fn(),
      query: jest.fn(),
    };

    transactionManager = {
      run: jest.fn().mockImplementation(async (cb) => cb({} as any)),
    };

    service = new ProductsService(
      productRepository,
      auditLogRepository,
      transactionManager
    );
  });

  describe("createProduct", () => {
    it("should create product and record audit log", async () => {
      productRepository.existsBySlug.mockResolvedValueOnce(false);
      productRepository.create.mockResolvedValueOnce(mockProductEntity);

      const result = await service.createProduct(
        {
          title: "Bovine Mastitis Protocol",
          type: ProductType.VIDEO_COURSE,
          description: "Detailed video clinical protocol on dairy cow mastitis management.",
          priceCents: 5000,
          discountPriceCents: 4000,
          contentS3Key: "courses/mastitis-v1/master.mp4",
        },
        "user-admin-id",
        "trace-123"
      );

      expect(productRepository.existsBySlug).toHaveBeenCalledWith(
        "bovine-mastitis-protocol"
      );
      expect(productRepository.create).toHaveBeenCalled();
      expect(auditLogRepository.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "CREATE",
          entityType: "Product",
          entityId: mockProductEntity.id,
          userId: "user-admin-id",
          traceId: "trace-123",
        }),
        expect.anything()
      );
      expect(result.id).toBe(mockProductEntity.id);
    });

    it("should throw EntityConflictException if slug already exists", async () => {
      productRepository.existsBySlug.mockResolvedValueOnce(true);

      await expect(
        service.createProduct({
          title: "Bovine Mastitis Protocol",
          type: ProductType.VIDEO_COURSE,
          description: "Detailed video clinical protocol on dairy cow mastitis management.",
          priceCents: 5000,
          contentS3Key: "courses/mastitis-v1/master.mp4",
        })
      ).rejects.toThrow(EntityConflictException);
    });
  });

  describe("updateProduct", () => {
    it("should update product and record audit log with old and new snapshots", async () => {
      productRepository.findById.mockResolvedValueOnce(mockProductEntity);
      productRepository.update.mockResolvedValueOnce(mockProductEntity);

      const result = await service.updateProduct(
        mockProductEntity.id,
        { priceCents: 6000 },
        "admin-id",
        "trace-456"
      );

      expect(productRepository.update).toHaveBeenCalled();
      expect(auditLogRepository.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "UPDATE",
          entityId: mockProductEntity.id,
          oldValues: expect.any(Object),
          newValues: expect.any(Object),
        }),
        expect.anything()
      );
      expect(result.id).toBe(mockProductEntity.id);
    });

    it("should throw EntityNotFoundException if product not found", async () => {
      productRepository.findById.mockResolvedValueOnce(null);

      await expect(
        service.updateProduct("unknown-id", { title: "New" })
      ).rejects.toThrow(EntityNotFoundException);
    });

    it("should throw EntityConflictException if updated slug conflicts with existing product", async () => {
      productRepository.findById.mockResolvedValueOnce(mockProductEntity);
      productRepository.existsBySlug.mockResolvedValueOnce(true);

      await expect(
        service.updateProduct(mockProductEntity.id, {
          slug: "already-taken-slug",
        })
      ).rejects.toThrow(EntityConflictException);
    });
  });

  describe("getProductById", () => {
    it("should return product if published", async () => {
      productRepository.findById.mockResolvedValueOnce(mockProductEntity);

      const result = await service.getProductById(mockProductEntity.id);
      expect(result.id).toBe(mockProductEntity.id);
      expect(result.contentS3Key).toBeUndefined();
    });

    it("should hide unpublished product from public query", async () => {
      const draftProduct = ProductEntity.reconstitute({
        ...mockProductProps,
        isPublished: false,
      });
      productRepository.findById.mockResolvedValueOnce(draftProduct);

      await expect(
        service.getProductById(draftProduct.id, false)
      ).rejects.toThrow(EntityNotFoundException);
    });

    it("should return unpublished product when includeUnpublished is true", async () => {
      const draftProduct = ProductEntity.reconstitute({
        ...mockProductProps,
        isPublished: false,
      });
      productRepository.findById.mockResolvedValueOnce(draftProduct);

      const result = await service.getProductById(draftProduct.id, true);
      expect(result.id).toBe(draftProduct.id);
    });
  });

  describe("listProducts", () => {
    it("should return paginated list forcing isPublished: true for public queries", async () => {
      productRepository.findMany.mockResolvedValueOnce({
        products: [mockProductEntity],
        total: 1,
      });

      const result = await service.listProducts(
        { page: 1, limit: 10 },
        false
      );

      expect(productRepository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          isPublished: true,
          skip: 0,
          take: 10,
        })
      );
      expect(result.items.length).toBe(1);
      expect(result.meta.totalPages).toBe(1);
    });
  });

  describe("searchProducts", () => {
    it("should throw ValidationDomainException when minPriceCents exceeds maxPriceCents", async () => {
      await expect(
        service.searchProducts({
          minPriceCents: 5000,
          maxPriceCents: 2000,
        })
      ).rejects.toThrow();
    });

    it("should execute search with sanitized query and parameters", async () => {
      productRepository.findMany.mockResolvedValueOnce({
        products: [mockProductEntity],
        total: 1,
      });

      const result = await service.searchProducts({
        q: "  dairy mastitis  ",
        minPriceCents: 1000,
        maxPriceCents: 8000,
        page: 1,
        limit: 10,
      });

      expect(productRepository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          search: "dairy mastitis",
          isPublished: true,
          minPriceCents: 1000,
          maxPriceCents: 8000,
          skip: 0,
          take: 10,
        })
      );
      expect(result.items.length).toBe(1);
      expect(result.meta.total).toBe(1);
    });
  });

  describe("deleteProduct", () => {
    it("should soft delete product and record audit log", async () => {
      productRepository.findById.mockResolvedValueOnce(mockProductEntity);

      await service.deleteProduct(mockProductEntity.id, "admin-user", "trace-789");

      expect(productRepository.softDelete).toHaveBeenCalledWith(
        mockProductEntity.id,
        expect.any(Date),
        expect.anything()
      );
      expect(auditLogRepository.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "DELETE",
          entityId: mockProductEntity.id,
        }),
        expect.anything()
      );
    });
  });
});
