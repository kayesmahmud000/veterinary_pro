import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { Reflector } from "@nestjs/core";
import * as supertest from "supertest";

const request =
  typeof supertest === "function"
    ? supertest
    : ((supertest as any).default ?? supertest);

import {
  ProductType,
  SubscriptionTier,
  UserRole,
  UserStatus,
} from "@vetralink/shared-types";
import { ProductsController } from "./products.controller";
import {
  IProductsService,
  PRODUCTS_SERVICE,
} from "./services/products.service.interface";
import {
  ITokenService,
  TOKEN_SERVICE,
} from "../auth/services/token.service.interface";
import { ResponseInterceptor } from "../../common/interceptors/response.interceptor";
import { GlobalExceptionFilter } from "../../common/filters/global-exception.filter";

describe("ProductsController (Integration via Supertest)", () => {
  let app: INestApplication;
  let productsService: jest.Mocked<IProductsService>;
  let tokenService: jest.Mocked<ITokenService>;

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

  const adminPayload = {
    sub: "admin-1111-1111-1111-111111111111",
    email: "admin@vetralink.com",
    role: UserRole.SUPER_ADMIN,
    status: UserStatus.ACTIVE,
  };

  const farmerPayload = {
    sub: "farmer-1111-1111-1111-111111111111",
    email: "farmer@vetralink.com",
    role: UserRole.FARMER,
    status: UserStatus.ACTIVE,
  };

  beforeAll(async () => {
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

    tokenService = {
      generateTokens: jest.fn(),
      generateAccessToken: jest.fn(),
      generateRefreshToken: jest.fn(),
      verifyAccessToken: jest.fn().mockImplementation(async (token: string) => {
        if (token === "admin-token") return adminPayload;
        if (token === "farmer-token") return farmerPayload;
        throw new Error("Invalid token");
      }),
      hashRefreshToken: jest.fn(),
      getRefreshTokenExpiresAt: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [
        {
          provide: PRODUCTS_SERVICE,
          useValue: productsService,
        },
        {
          provide: TOKEN_SERVICE,
          useValue: tokenService,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();

    const reflector = app.get(Reflector);
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      })
    );
    app.useGlobalInterceptors(new ResponseInterceptor(reflector));
    app.useGlobalFilters(new GlobalExceptionFilter());

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /products", () => {
    it("should allow public access and return wrapped ApiResponse", async () => {
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

      const response = await request(app.getHttpServer())
        .get("/products")
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        statusCode: 200,
        message: "Products retrieved successfully",
        data: expect.any(Array),
        meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      });
    });
  });

  describe("GET /products/search", () => {
    it("should allow public access to product search with filters and pagination", async () => {
      productsService.searchProducts.mockResolvedValueOnce({
        items: [mockProductResponse],
        meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      });

      const response = await request(app.getHttpServer())
        .get(
          "/products/search?q=mastitis&type=VIDEO_COURSE&minPriceCents=1000&maxPriceCents=8000&sortBy=price_asc"
        )
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        statusCode: 200,
        message: "Product search results retrieved successfully",
        data: expect.any(Array),
        meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      });

      expect(productsService.searchProducts).toHaveBeenCalledWith(
        expect.objectContaining({
          q: "mastitis",
          type: ProductType.VIDEO_COURSE,
          minPriceCents: 1000,
          maxPriceCents: 8000,
          sortBy: "price_asc",
        })
      );
    });
  });

  describe("POST /products", () => {
    it("should reject request without token with 401", async () => {
      await request(app.getHttpServer())
        .post("/products")
        .send({
          title: "Bovine Mastitis Protocol",
          type: "VIDEO_COURSE",
          description: "Detailed video clinical protocol on dairy cow mastitis management.",
          priceCents: 5000,
          contentS3Key: "courses/mastitis-v1/master.mp4",
        })
        .expect(401);
    });

    it("should reject non-admin request with 403", async () => {
      await request(app.getHttpServer())
        .post("/products")
        .set("Authorization", "Bearer farmer-token")
        .send({
          title: "Bovine Mastitis Protocol",
          type: "VIDEO_COURSE",
          description: "Detailed video clinical protocol on dairy cow mastitis management.",
          priceCents: 5000,
          contentS3Key: "courses/mastitis-v1/master.mp4",
        })
        .expect(403);
    });

    it("should reject validation error (e.g. negative price) with 400", async () => {
      const response = await request(app.getHttpServer())
        .post("/products")
        .set("Authorization", "Bearer admin-token")
        .send({
          title: "Bad Product",
          type: "VIDEO_COURSE",
          description: "Valid description of at least ten characters.",
          priceCents: -500,
          contentS3Key: "courses/mastitis-v1/master.mp4",
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors.length).toBeGreaterThan(0);
    });

    it("should allow admin to create product with 201", async () => {
      productsService.createProduct.mockResolvedValueOnce(mockProductResponse);

      const response = await request(app.getHttpServer())
        .post("/products")
        .set("Authorization", "Bearer admin-token")
        .send({
          title: "Bovine Mastitis Protocol",
          type: "VIDEO_COURSE",
          description: "Detailed video clinical protocol on dairy cow mastitis management.",
          priceCents: 5000,
          discountPriceCents: 4000,
          contentS3Key: "courses/mastitis-v1/master.mp4",
        })
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        statusCode: 201,
        message: "Product created successfully",
        data: mockProductResponse,
      });
    });
  });

  describe("PATCH /products/:id", () => {
    it("should allow admin to update product with 200", async () => {
      productsService.updateProduct.mockResolvedValueOnce({
        ...mockProductResponse,
        priceCents: 6000,
      });

      const response = await request(app.getHttpServer())
        .patch(`/products/${mockProductResponse.id}`)
        .set("Authorization", "Bearer admin-token")
        .send({ priceCents: 6000 })
        .expect(200);

      expect(response.body.data.priceCents).toBe(6000);
    });
  });

  describe("DELETE /products/:id", () => {
    it("should allow admin to soft delete product with 200", async () => {
      productsService.deleteProduct.mockResolvedValueOnce();

      const response = await request(app.getHttpServer())
        .delete(`/products/${mockProductResponse.id}`)
        .set("Authorization", "Bearer admin-token")
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        statusCode: 200,
        message: "Product deleted successfully",
        data: null,
      });
    });
  });
});
