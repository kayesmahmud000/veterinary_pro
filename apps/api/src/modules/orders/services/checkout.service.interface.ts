import {
  CheckoutResponseDto,
  CreateCheckoutRequestDto,
  OrderDetailResponseDto,
} from "@vetralink/shared-types";

export interface ICheckoutService {
  checkout(
    userId: string,
    dto: CreateCheckoutRequestDto,
    userEmail?: string,
    traceId?: string,
    ipAddress?: string
  ): Promise<CheckoutResponseDto>;

  getOrderById(
    orderId: string,
    requestingUserId: string,
    isAdmin?: boolean
  ): Promise<OrderDetailResponseDto>;

  getUserOrders(
    userId: string,
    page?: number,
    limit?: number
  ): Promise<{ orders: OrderDetailResponseDto[]; total: number }>;
}

export const CHECKOUT_SERVICE = "CHECKOUT_SERVICE";
