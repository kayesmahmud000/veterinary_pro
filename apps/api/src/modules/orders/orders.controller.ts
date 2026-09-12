import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Ip,
  Optional,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import {
  CheckoutResponseDto,
  JwtPayload,
  OrderDetailResponseDto,
  OrderDownloadTokensResponseDto,
  UserRole,
} from "@vetralink/shared-types";
import { CurrentUser, ResponseMessage } from "../../common/decorators";
import { JwtAuthGuard, RolesGuard } from "../../common/guards";
import {
  Idempotent,
  IdempotencyInterceptor,
} from "../../common/idempotency";
import {
  ICheckoutService,
  CHECKOUT_SERVICE,
} from "./services/checkout.service.interface";
import {
  IOrderFulfillmentService,
  ORDER_FULFILLMENT_SERVICE,
} from "./services/order-fulfillment.service.interface";
import { CreateCheckoutDto } from "./dto/create-checkout.dto";

@ApiTags("Orders")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(IdempotencyInterceptor)
@Controller("orders")
export class OrdersController {
  constructor(
    @Inject(CHECKOUT_SERVICE)
    private readonly checkoutService: ICheckoutService,
    @Optional()
    @Inject(ORDER_FULFILLMENT_SERVICE)
    private readonly fulfillmentService?: IOrderFulfillmentService
  ) {}

  @Post("checkout")
  @HttpCode(HttpStatus.CREATED)
  @Idempotent({ header: "idempotency-key", ttlSeconds: 86400, lockTtlSeconds: 60 })
  @ApiOperation({
    summary: "Initialize an ACID checkout workflow",
    description:
      "Calculates authoritative prices from database products, creates a pending order with snapshot line items, and dispatches a payment intent to the gateway.",
  })
  @ApiHeader({
    name: "idempotency-key",
    required: false,
    description: "Unique client idempotency key to prevent duplicate checkouts",
  })
  @ApiCreatedResponse({
    description: "Checkout workflow initialized with payment intent.",
  })
  @ApiUnauthorizedResponse({ description: "Authentication required." })
  @ResponseMessage("Checkout initialized successfully.")
  public async checkout(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateCheckoutDto,
    @Headers("x-trace-id") traceId?: string,
    @Ip() ipAddress?: string
  ): Promise<CheckoutResponseDto> {
    return this.checkoutService.checkout(
      user.sub,
      dto,
      user.email,
      traceId,
      ipAddress
    );
  }

  @Get("my-orders")
  @ApiOperation({
    summary: "Get current user's order history",
    description:
      "Returns paginated orders belonging to the authenticated user.",
  })
  @ApiQuery({ name: "page", required: false, type: Number, example: 1 })
  @ApiQuery({ name: "limit", required: false, type: Number, example: 20 })
  @ApiOkResponse({ description: "Paginated list of orders." })
  @ApiUnauthorizedResponse({ description: "Authentication required." })
  @ResponseMessage("Orders retrieved successfully.")
  public async getMyOrders(
    @CurrentUser() user: JwtPayload,
    @Query("page") page?: string,
    @Query("limit") limit?: string
  ): Promise<{ orders: OrderDetailResponseDto[]; total: number }> {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;

    return this.checkoutService.getUserOrders(user.sub, pageNum, limitNum);
  }

  @Get(":id")
  @ApiOperation({
    summary: "Get single order details",
    description:
      "Returns detailed order info including snapshot items and download tokens. Only accessible by the order owner or a system administrator.",
  })
  @ApiOkResponse({ description: "Order details retrieved." })
  @ApiNotFoundResponse({ description: "Order not found." })
  @ApiForbiddenResponse({
    description: "Forbidden: user does not own this order.",
  })
  @ApiUnauthorizedResponse({ description: "Authentication required." })
  @ResponseMessage("Order retrieved successfully.")
  public async getOrderById(
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) id: string
  ): Promise<OrderDetailResponseDto> {
    const isAdmin = user.role === UserRole.ADMIN;
    return this.checkoutService.getOrderById(id, user.sub, isAdmin);
  }

  @Get(":id/download-tokens")
  @ApiOperation({
    summary: "Get active download tokens for completed order",
    description:
      "Returns active download tokens, quotas, and remaining downloads for digital items. Only accessible by the order owner or an administrator for settled (COMPLETED) orders.",
  })
  @ApiOkResponse({ description: "Download tokens retrieved." })
  @ApiNotFoundResponse({ description: "Order not found." })
  @ApiForbiddenResponse({
    description: "Forbidden: user does not own this order.",
  })
  @ApiBadRequestResponse({
    description: "Bad Request: order is not in COMPLETED status.",
  })
  @ApiUnauthorizedResponse({ description: "Authentication required." })
  @ResponseMessage("Download tokens retrieved successfully.")
  public async getOrderDownloadTokens(
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) id: string
  ): Promise<OrderDownloadTokensResponseDto> {
    if (!this.fulfillmentService) {
      throw new BadRequestException("Order fulfillment service is unavailable.");
    }
    return this.fulfillmentService.getOrderDownloadTokens(
      id,
      user.sub,
      user.role
    );
  }
}
