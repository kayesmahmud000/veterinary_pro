import { Test, TestingModule } from "@nestjs/testing";
import { ProductType, SubscriptionTier, UserRole, UserStatus } from "@vetralink/shared-types";
import { ProductsController } from "./products.controller";
import {
  IProductsService,
  PRODUCTS_SERVICE,
} from "./services/products.service.interface";
import { Reflector } from "@nestjs/core";
import { TOKEN_SERVICE } from "../auth/services/token.service.interface";

describe("ProductsController", () => {
  let controller: ProductsController;
  let productsService: jest.Mocked<IProductsService>;

  const mockAdminUser = {
    sub: "admin-1111-1111-1111-111111111111",
    email: "admin@vetralink.com",
    role: UserRole.SUPER_ADMIN,
    status: UserStatus.ACTIVE,
  };

  const mockProductResponse = {
    id: "prod-1111-1111-1111-111111111111",
    title: "Bovine Mastitis Protocol",
    slug: "bovine-mastitis-protocol",
    type: ProductType.VIDEO_COURSE,
    description: "Detailed video clinical protocol on dairy cow mastitis management.",
    priceCents: 5000,
    discountPriceCents: 4000,
    effectivePriceCents: 4000,
    currency: "USD",
    minSubscriptionTier: SubscriptionTier.STARTER,
    isPublished: true,
    metadata: { durationMinutes: 120 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(async () => {
    productsService = {
      createProduct: jest.fn(),
      updateProduct: jest.fn(),
      getProductById: jest.fn(),
      getProductBySlug: jest.fn(),
      listProducts: jest.fn(),
      searchProducts: jest.fn(),
      deleteProduct: jest.fn(),
      publishProduct: jest.fn(),
      unpublishProduct: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [
        {
          provide: PRODUCTS_SERVICE,
          useValue: productsService,
        },
        {
          provide: TOKEN_SERVICE,
          useValue: { verifyAccessToken: jest.fn() },
        },
        Reflector,
      ],
    }).compile();

    controller = module.get<ProductsController>(ProductsController);
  });

  describe("createProduct", () => {
    it("should delegate to productsService.createProduct with user.sub and traceId", async () => {
      productsService.createProduct.mockResolvedValueOnce(mockProductResponse);

      const dto = {
        title: "Bovine Mastitis Protocol",
        type: ProductType.VIDEO_COURSE,
        description: "Detailed video clinical protocol on dairy cow mastitis management.",
        priceCents: 5000,
        contentS3Key: "courses/mastitis-v1/master.mp4",
      };

      const result = await controller.createProduct(
        dto,
        mockAdminUser,
        "trace-123"
      );

      expect(productsService.createProduct).toHaveBeenCalledWith(
        dto,
        mockAdminUser.sub,
        "trace-123"
      );
      expect(result).toEqual(mockProductResponse);
    });
  });

  describe("listProducts", () => {
    it("should delegate to productsService.listProducts", async () => {
      productsService.listProducts.mockResolvedValueOnce({
        items: [
          {
            id: mockProductResponse.id,
            title: mockProductResponse.title,
            slug: mockProductResponse.slug,
            type: mockProductResponse.type,
            priceCents: mockProductResponse.priceCents,
            discountPriceCents: mockProductResponse.discountPriceCents,
            effectivePriceCents: mockProductResponse.effectivePriceCents,
            currency: mockProductResponse.currency,
            minSubscriptionTier: mockProductResponse.minSubscriptionTier,
            isPublished: mockProductResponse.isPublished,
            metadata: mockProductResponse.metadata,
            createdAt: mockProductResponse.createdAt,
          },
        ],
        meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      });

      const result = await controller.listProducts({ page: 1, limit: 20 });
      expect(result.items.length).toBe(1);
      expect(productsService.listProducts).toHaveBeenCalledWith(
        { page: 1, limit: 20 },
        false
      );
    });
  });

  describe("searchProducts", () => {
    it("should delegate to productsService.searchProducts with query parameters", async () => {
      productsService.searchProducts.mockResolvedValueOnce({
        items: [
          {
            id: mockProductResponse.id,
            title: mockProductResponse.title,
            slug: mockProductResponse.slug,
            type: mockProductResponse.type,
            priceCents: mockProductResponse.priceCents,
            discountPriceCents: mockProductResponse.discountPriceCents,
            effectivePriceCents: mockProductResponse.effectivePriceCents,
            currency: mockProductResponse.currency,
            minSubscriptionTier: mockProductResponse.minSubscriptionTier,
            isPublished: mockProductResponse.isPublished,
            metadata: mockProductResponse.metadata,
            createdAt: mockProductResponse.createdAt,
          },
        ],
        meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      });

      const queryDto = { q: "mastitis", page: 1, limit: 20 };
      const result = await controller.searchProducts(queryDto);

      expect(result.items.length).toBe(1);
      expect(productsService.searchProducts).toHaveBeenCalledWith(queryDto);
    });
  });

  describe("getProductById", () => {
    it("should return product by id", async () => {
      productsService.getProductById.mockResolvedValueOnce(mockProductResponse);

      const result = await controller.getProductById(mockProductResponse.id);
      expect(result.id).toBe(mockProductResponse.id);
      expect(productsService.getProductById).toHaveBeenCalledWith(
        mockProductResponse.id,
        false,
        false
      );
    });
  });

  describe("getProductBySlug", () => {
    it("should return product by slug", async () => {
      productsService.getProductBySlug.mockResolvedValueOnce(
        mockProductResponse
      );

      const result = await controller.getProductBySlug(
        mockProductResponse.slug
      );
      expect(result.slug).toBe(mockProductResponse.slug);
    });
  });

  describe("updateProduct", () => {
    it("should delegate update to service", async () => {
      productsService.updateProduct.mockResolvedValueOnce({
        ...mockProductResponse,
        priceCents: 6000,
      });

      const result = await controller.updateProduct(
        mockProductResponse.id,
        { priceCents: 6000 },
        mockAdminUser,
        "trace-456"
      );

      expect(productsService.updateProduct).toHaveBeenCalledWith(
        mockProductResponse.id,
        { priceCents: 6000 },
        mockAdminUser.sub,
        "trace-456"
      );
      expect(result.priceCents).toBe(6000);
    });
  });

  describe("deleteProduct", () => {
    it("should delegate delete to service and return null", async () => {
      productsService.deleteProduct.mockResolvedValueOnce();

      const result = await controller.deleteProduct(
        mockProductResponse.id,
        mockAdminUser,
        "trace-789"
      );

      expect(productsService.deleteProduct).toHaveBeenCalledWith(
        mockProductResponse.id,
        mockAdminUser.sub,
        "trace-789"
      );
      expect(result).toBeNull();
    });
  });
});
