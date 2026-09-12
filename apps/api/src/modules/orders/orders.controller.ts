import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Ip,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
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
  UserRole,
} from "@vetralink/shared-types";
import { CurrentUser, ResponseMessage } from "../../common/decorators";
import { JwtAuthGuard, RolesGuard } from "../../common/guards";
import {
  ICheckoutService,
  CHECKOUT_SERVICE,
} from "./services/checkout.service.interface";
import { CreateCheckoutDto } from "./dto/create-checkout.dto";

@ApiTags("Orders")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("orders")
export class OrdersController {
  constructor(
    @Inject(CHECKOUT_SERVICE)
    private readonly checkoutService: ICheckoutService
  ) {}

  @Post("checkout")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Initialize an ACID checkout workflow",
    description:
      "Calculates authoritative prices from database products, creates a pending order with snapshot line items, and dispatches a payment intent to the gateway.",
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
}
