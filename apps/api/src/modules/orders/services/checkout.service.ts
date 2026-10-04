import { Inject, Injectable, Logger } from "@nestjs/common";
import * as crypto from "crypto";
import {
  CheckoutResponseDto,
  CreateCheckoutRequestDto,
  OrderDetailResponseDto,
  OrderStatus,
} from "@vetralink/shared-types";
import {
  IOrderRepository,
  ORDER_REPOSITORY,
} from "../repositories/order.repository.interface";
import {
  IProductRepository,
  PRODUCT_REPOSITORY,
} from "../../products/repositories/product.repository.interface";
import {
  IPaymentGatewayService,
  PAYMENT_GATEWAY_SERVICE,
} from "./payment-gateway.service.interface";
import {
  ITransactionManager,
  TRANSACTION_MANAGER,
} from "../../prisma/interfaces/transaction.interface";
import {
  IAuditLogRepository,
  AUDIT_LOG_REPOSITORY,
} from "../../audit/repositories/audit-log.repository.interface";
import { ICheckoutService } from "./checkout.service.interface";
import { OrderEntity } from "../entities/order.entity";
import { OrderItemEntity } from "../entities/order-item.entity";
import {
  EntityNotFoundException,
  ForbiddenOperationException,
  ValidationDomainException,
} from "../../../common/exceptions/domain.exception";

@Injectable()
export class CheckoutService implements ICheckoutService {
  private readonly logger = new Logger(CheckoutService.name);

  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: IOrderRepository,
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: IProductRepository,
    @Inject(PAYMENT_GATEWAY_SERVICE)
    private readonly paymentGatewayService: IPaymentGatewayService,
    @Inject(TRANSACTION_MANAGER)
    private readonly transactionManager: ITransactionManager,
    @Inject(AUDIT_LOG_REPOSITORY)
    private readonly auditLogRepository: IAuditLogRepository
  ) {}

  public async checkout(
    userId: string,
    dto: CreateCheckoutRequestDto,
    userEmail?: string,
    traceId?: string,
    ipAddress?: string
  ): Promise<CheckoutResponseDto> {
    if (!dto.items || dto.items.length === 0) {
      throw new ValidationDomainException("Checkout requires at least one item.");
    }

    const productIds = dto.items.map((item) => item.productId);
    const uniqueIds = new Set(productIds);
    if (uniqueIds.size !== productIds.length) {
      throw new ValidationDomainException(
        "Duplicate products in checkout are not allowed."
      );
    }

    // Authoritatively resolve and validate products from database
    const products = await Promise.all(
      dto.items.map(async (item) => {
        const product = await this.productRepository.findById(item.productId);
        if (!product || product.deletedAt !== null) {
          throw new ValidationDomainException(
            `Product with ID '${item.productId}' does not exist or has been removed.`
          );
        }
        if (!product.isPublished) {
          throw new ValidationDomainException(
            `Product '${product.title}' is currently not available for purchase.`
          );
        }
        return product;
      })
    );

    // Compute authoritative prices from database
    let totalCents = 0;
    const orderItems = products.map((product) => {
      const priceCents =
        product.discountPriceCents !== null &&
        product.discountPriceCents !== undefined
          ? product.discountPriceCents
          : product.priceCents;

      totalCents += priceCents;

      return OrderItemEntity.create({
        productId: product.id,
        productTitle: product.title,
        priceCents,
      });
    });

    const currency = products[0]?.currency ?? "USD";
    const paymentGateway =
      dto.paymentGateway || this.paymentGatewayService.gatewayName || "stripe";

    const order = OrderEntity.create({
      userId,
      totalCents,
      currency,
      paymentGateway,
      items: orderItems,
    });

    const activeTraceId = traceId ?? crypto.randomUUID();

    // Execute order creation, payment gateway intent, and audit log atomically in $transaction
    return this.transactionManager.run(async (tx) => {
      const savedOrder = await this.orderRepository.create(
        order,
        orderItems,
        tx
      );

      const paymentResult =
        await this.paymentGatewayService.createPaymentIntent(
          savedOrder.id,
          savedOrder.totalCents,
          savedOrder.currency,
          userEmail,
          {
            orderId: savedOrder.id,
            userId,
          }
        );

      savedOrder.setGatewayTxId(paymentResult.gatewayTxId);
      await this.orderRepository.updateStatus(
        savedOrder.id,
        OrderStatus.PENDING,
        paymentResult.gatewayTxId,
        tx
      );

      await this.auditLogRepository.record(
        {
          userId,
          action: "ORDER_CREATED",
          entityType: "Order",
          entityId: savedOrder.id,
          newValues: {
            totalCents: savedOrder.totalCents,
            currency: savedOrder.currency,
            itemCount: savedOrder.items.length,
            paymentGateway: savedOrder.paymentGateway,
            gatewayTxId: paymentResult.gatewayTxId,
          },
          traceId: activeTraceId,
          ipAddress,
        },
        tx
      );

      this.logger.log(
        `Created checkout order ${savedOrder.id} (${savedOrder.totalCents} ${savedOrder.currency}) with gatewayTxId ${paymentResult.gatewayTxId}`
      );

      return {
        orderId: savedOrder.id,
        totalCents: savedOrder.totalCents,
        currency: savedOrder.currency,
        status: savedOrder.status,
        paymentGateway: savedOrder.paymentGateway,
        gatewayTxId: paymentResult.gatewayTxId,
        clientSecret: paymentResult.clientSecret,
        checkoutUrl: paymentResult.checkoutUrl,
        items: savedOrder.items.map((i) => i.toResponse()),
        createdAt: savedOrder.createdAt.toISOString(),
      };
    });
  }

  public async getOrderById(
    orderId: string,
    requestingUserId: string,
    isAdmin = false
  ): Promise<OrderDetailResponseDto> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new EntityNotFoundException("Order", orderId);
    }

    if (!isAdmin && order.userId !== requestingUserId) {
      throw new ForbiddenOperationException(
        "You do not have permission to view this order."
      );
    }

    return order.toDetailResponse();
  }

  public async getUserOrders(
    userId: string,
    page = 1,
    limit = 20
  ): Promise<{ orders: OrderDetailResponseDto[]; total: number }> {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const skip = (safePage - 1) * safeLimit;

    const { orders, total } = await this.orderRepository.findUserOrders(
      userId,
      skip,
      safeLimit
    );

    return {
      orders: orders.map((o) => o.toDetailResponse()),
      total,
    };
  }
}
