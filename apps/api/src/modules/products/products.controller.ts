import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import {
  JwtPayload,
  PaginationMeta,
  ProductListItemDto,
  ProductResponseDto,
  UserRole,
} from "@vetralink/shared-types";
import {
  CurrentUser,
  Public,
  ResponseMessage,
  Roles,
} from "../../common/decorators";
import { JwtAuthGuard, RolesGuard } from "../../common/guards";
import {
  IProductsService,
  PRODUCTS_SERVICE,
} from "./services/products.service.interface";
import {
  CreateProductDto,
  ProductQueryDto,
  UpdateProductDto,
} from "./dto";

@ApiTags("Products")
@Controller("products")
export class ProductsController {
  constructor(
    @Inject(PRODUCTS_SERVICE)
    private readonly productsService: IProductsService
  ) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage("Product created successfully")
  @ApiOperation({ summary: "Create a new digital product master (Admin only)" })
  @ApiCreatedResponse({ description: "Product created successfully" })
  @ApiConflictResponse({ description: "Product slug already exists" })
  @ApiForbiddenResponse({ description: "Requires SUPER_ADMIN or ADMIN role" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid token" })
  public async createProduct(
    @Body() dto: CreateProductDto,
    @CurrentUser() user: JwtPayload,
    @Headers("x-trace-id") traceId?: string
  ): Promise<ProductResponseDto> {
    return this.productsService.createProduct(dto, user.sub, traceId);
  }

  @Get()
  @Public()
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("Products retrieved successfully")
  @ApiOperation({
    summary: "List catalog products with pagination, filters and search",
  })
  @ApiOkResponse({ description: "Products retrieved successfully" })
  public async listProducts(
    @Query() query: ProductQueryDto,
    @CurrentUser() user?: JwtPayload
  ): Promise<{ items: ProductListItemDto[]; meta: PaginationMeta }> {
    const isAdmin =
      user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.ADMIN;
    return this.productsService.listProducts(query, isAdmin);
  }

  @Get(":id")
  @Public()
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("Product retrieved successfully")
  @ApiOperation({ summary: "Get single product by UUID" })
  @ApiOkResponse({ description: "Product retrieved successfully" })
  @ApiNotFoundResponse({ description: "Product not found or unpublished" })
  public async getProductById(
    @Param("id") id: string,
    @CurrentUser() user?: JwtPayload
  ): Promise<ProductResponseDto> {
    const isAdmin =
      user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.ADMIN;
    return this.productsService.getProductById(id, isAdmin, isAdmin);
  }

  @Get("slug/:slug")
  @Public()
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("Product retrieved successfully")
  @ApiOperation({ summary: "Get single product by SEO slug" })
  @ApiOkResponse({ description: "Product retrieved successfully" })
  @ApiNotFoundResponse({ description: "Product not found or unpublished" })
  public async getProductBySlug(
    @Param("slug") slug: string,
    @CurrentUser() user?: JwtPayload
  ): Promise<ProductResponseDto> {
    const isAdmin =
      user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.ADMIN;
    return this.productsService.getProductBySlug(slug, isAdmin, isAdmin);
  }

  @Patch(":id")
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("Product updated successfully")
  @ApiOperation({ summary: "Update product details or pricing (Admin only)" })
  @ApiOkResponse({ description: "Product updated successfully" })
  @ApiNotFoundResponse({ description: "Product not found" })
  @ApiForbiddenResponse({ description: "Requires SUPER_ADMIN or ADMIN role" })
  public async updateProduct(
    @Param("id") id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() user: JwtPayload,
    @Headers("x-trace-id") traceId?: string
  ): Promise<ProductResponseDto> {
    return this.productsService.updateProduct(id, dto, user.sub, traceId);
  }

  @Delete(":id")
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("Product deleted successfully")
  @ApiOperation({ summary: "Soft delete product (Admin only)" })
  @ApiOkResponse({ description: "Product deleted successfully" })
  @ApiNotFoundResponse({ description: "Product not found" })
  @ApiForbiddenResponse({ description: "Requires SUPER_ADMIN or ADMIN role" })
  public async deleteProduct(
    @Param("id") id: string,
    @CurrentUser() user: JwtPayload,
    @Headers("x-trace-id") traceId?: string
  ): Promise<null> {
    await this.productsService.deleteProduct(id, user.sub, traceId);
    return null;
  }
}
