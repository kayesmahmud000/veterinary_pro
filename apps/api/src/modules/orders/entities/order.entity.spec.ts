import { OrderStatus } from "@vetralink/shared-types";
import { OrderEntity } from "./order.entity";
import { OrderItemEntity } from "./order-item.entity";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";

describe("Order & OrderItem Entities", () => {
  const mockUserId = "user-1111-1111-1111-111111111111";
  const mockProductId = "prod-1111-1111-1111-111111111111";

  describe("OrderItemEntity", () => {
    it("should create order item with generated ID and token", () => {
      const item = OrderItemEntity.create({
        productId: mockProductId,
        productTitle: "Dairy Health Protocol",
        priceCents: 4900,
      });

      expect(item.id).toBeDefined();
      expect(item.productId).toBe(mockProductId);
      expect(item.productTitle).toBe("Dairy Health Protocol");
      expect(item.priceCents).toBe(4900);
      expect(item.downloadToken).toBeDefined();
      expect(item.downloadCount).toBe(0);
      expect(item.lastDownloadedAt).toBeNull();
    });

    it("should reject negative priceCents", () => {
      expect(() =>
        OrderItemEntity.create({
          productId: mockProductId,
          priceCents: -100,
        })
      ).toThrow(ValidationDomainException);
    });

    it("should record download and update timestamp", () => {
      const item = OrderItemEntity.create({
        productId: mockProductId,
        priceCents: 4900,
      });

      expect(item.downloadCount).toBe(0);
      item.recordDownload();
      expect(item.downloadCount).toBe(1);
      expect(item.lastDownloadedAt).toBeInstanceOf(Date);
    });
  });

  describe("OrderEntity", () => {
    it("should create pending order with default currency and gateway", () => {
      const item = OrderItemEntity.create({
        productId: mockProductId,
        productTitle: "Course",
        priceCents: 4900,
      });

      const order = OrderEntity.create({
        userId: mockUserId,
        totalCents: 4900,
        items: [item],
      });

      expect(order.id).toBeDefined();
      expect(order.userId).toBe(mockUserId);
      expect(order.totalCents).toBe(4900);
      expect(order.currency).toBe("USD");
      expect(order.status).toBe(OrderStatus.PENDING);
      expect(order.paymentGateway).toBe("stripe");
      expect(order.gatewayTxId).toBeNull();
      expect(order.items.length).toBe(1);
      expect(order.items[0]!.orderId).toBe(order.id);
    });

    it("should reject negative totalCents", () => {
      expect(() =>
        OrderEntity.create({
          userId: mockUserId,
          totalCents: -50,
        })
      ).toThrow(ValidationDomainException);
    });

    it("should reject missing userId", () => {
      expect(() =>
        OrderEntity.create({
          userId: "",
          totalCents: 100,
        })
      ).toThrow(ValidationDomainException);
    });

    it("should transition status to COMPLETED on markCompleted", () => {
      const order = OrderEntity.create({
        userId: mockUserId,
        totalCents: 4900,
      });

      expect(order.status).toBe(OrderStatus.PENDING);
      order.markCompleted("pi_stripe_123");
      expect(order.status).toBe(OrderStatus.COMPLETED);
      expect(order.gatewayTxId).toBe("pi_stripe_123");
    });

    it("should transition status to FAILED on markFailed", () => {
      const order = OrderEntity.create({
        userId: mockUserId,
        totalCents: 4900,
      });

      order.markFailed();
      expect(order.status).toBe(OrderStatus.FAILED);
    });

    it("should format detail response with mapped items", () => {
      const item = OrderItemEntity.create({
        productId: mockProductId,
        productTitle: "eBook Guide",
        priceCents: 2500,
      });

      const order = OrderEntity.create({
        userId: mockUserId,
        totalCents: 2500,
        items: [item],
      });

      const res = order.toDetailResponse();
      expect(res.id).toBe(order.id);
      expect(res.totalCents).toBe(2500);
      expect(res.items.length).toBe(1);
      expect(res.items[0]!.productTitle).toBe("eBook Guide");
    });
  });
});
