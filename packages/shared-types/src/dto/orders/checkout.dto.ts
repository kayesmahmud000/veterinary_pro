import { OrderStatus } from "../../enums/index.js";

export interface CheckoutItemRequestDto {
  readonly productId: string;
}

export interface CreateCheckoutRequestDto {
  readonly items: CheckoutItemRequestDto[];
  readonly paymentGateway?: string;
  readonly successUrl?: string;
  readonly cancelUrl?: string;
}

export interface OrderItemResponseDto {
  readonly id: string;
  readonly productId: string;
  readonly productTitle: string;
  readonly priceCents: number;
  readonly downloadToken: string;
  readonly downloadCount: number;
  readonly lastDownloadedAt: string | null;
}

export interface CheckoutResponseDto {
  readonly orderId: string;
  readonly totalCents: number;
  readonly currency: string;
  readonly status: OrderStatus;
  readonly paymentGateway: string;
  readonly gatewayTxId?: string | null;
  readonly clientSecret?: string;
  readonly checkoutUrl?: string;
  readonly items: OrderItemResponseDto[];
  readonly createdAt: string;
}

export interface OrderDetailResponseDto {
  readonly id: string;
  readonly userId: string;
  readonly totalCents: number;
  readonly currency: string;
  readonly status: OrderStatus;
  readonly paymentGateway: string;
  readonly gatewayTxId: string | null;
  readonly items: OrderItemResponseDto[];
  readonly createdAt: string;
  readonly updatedAt: string;
}
