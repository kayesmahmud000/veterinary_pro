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
  Res,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { Response } from "express";
import * as crypto from "crypto";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiFoundResponse,
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
  SecureDownloadResponseDto,
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

  @Get(":id/download")
  @ApiOperation({
    summary: "Download secured digital asset with quota counter",
    description:
      "Generates a time-limited presigned S3 download URL (15-minute TTL) for a purchased digital asset, enforces quota limits (5 downloads max), and increments usage counter. Supports optional ?redirect=true for browser direct downloads.",
  })
  @ApiQuery({
    name: "token",
    required: true,
    type: String,
    description: "Digital item download token UUID",
  })
  @ApiQuery({
    name: "redirect",
    required: false,
    type: Boolean,
    description: "If true, redirects (HTTP 302) directly to presigned download URL",
  })
  @ApiOkResponse({
    description: "Presigned download URL and quota status retrieved.",
  })
  @ApiBadRequestResponse({
    description: "Bad Request: invalid token or quota limit exceeded.",
  })
  @ApiForbiddenResponse({
    description: "Forbidden: user does not own this order.",
  })
  @ApiFoundResponse({
    description: "HTTP 302 redirect directly to presigned download URL.",
  })
  @ApiNotFoundResponse({ description: "Order not found." })
  @ApiUnauthorizedResponse({ description: "Authentication required." })
  @ResponseMessage("Download link generated successfully.")
  public async downloadOrderItem(
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Query("token") downloadToken: string,
    @Res() res: Response,
    @Query("redirect") redirect?: string,
    @Headers("x-trace-id") traceId?: string,
    @Ip() ipAddress?: string
  ): Promise<void> {
    if (!this.fulfillmentService) {
      throw new BadRequestException("Order fulfillment service is unavailable.");
    }
    if (!downloadToken || downloadToken.trim() === "") {
      throw new BadRequestException("Query parameter 'token' is required.");
    }

    const result = await this.fulfillmentService.getSecureDownloadUrl(
      id,
      downloadToken.trim(),
      user.sub,
      user.role,
      traceId,
      ipAddress
    );

    if (redirect === "true") {
      res.redirect(HttpStatus.FOUND, result.downloadUrl);
      return;
    }

    const activeTraceId = traceId || crypto.randomUUID();
    res.setHeader("x-trace-id", activeTraceId);
    res.status(HttpStatus.OK).json({
      success: true,
      statusCode: HttpStatus.OK,
      message: "Download link generated successfully.",
      data: result,
      traceId: activeTraceId,
      timestamp: new Date().toISOString(),
    });
  }

  @Post(":id/resend-email")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Resend transactional order delivery email with download links",
    description:
      "Re-triggers asynchronous dispatch of digital download links email to the verified owner of the completed order.",
  })
  @ApiOkResponse({ description: "Email delivery job enqueued successfully." })
  @ApiBadRequestResponse({
    description: "Order is not completed or fulfillment service unavailable.",
  })
  @ApiForbiddenResponse({ description: "Forbidden: user does not own this order." })
  @ApiNotFoundResponse({ description: "Order not found." })
  @ApiUnauthorizedResponse({ description: "Authentication required." })
  @ResponseMessage("Order delivery email enqueued successfully.")
  public async resendOrderEmail(
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Headers("x-trace-id") traceId?: string
  ): Promise<{ enqueued: boolean; orderId: string }> {
    if (!this.fulfillmentService) {
      throw new BadRequestException("Order fulfillment service is unavailable.");
    }

    return this.fulfillmentService.resendOrderDeliveryEmail(
      id,
      user.sub,
      user.role,
      traceId
    );
  }
}
