import { Module } from "@nestjs/common";
import { AppConfigModule, EnvService } from "../../config";
import { PrismaModule } from "../prisma";
import { AuditModule } from "../audit";
import { AuthModule } from "../auth";
import { ProductsModule } from "../products/products.module";
import { OrderRepository } from "./repositories/order.repository";
import { ORDER_REPOSITORY } from "./repositories/order.repository.interface";
import { CheckoutService } from "./services/checkout.service";
import { CHECKOUT_SERVICE } from "./services/checkout.service.interface";
import { PAYMENT_GATEWAY_SERVICE } from "./services/payment-gateway.service.interface";
import { StripePaymentService } from "./services/stripe-payment.service";
import { MockPaymentGatewayService } from "./services/mock-payment-gateway.service";
import { OrdersController } from "./orders.controller";
import { StripeWebhookController } from "./controllers/stripe-webhook.controller";
import { StripeWebhookService } from "./services/stripe-webhook.service";
import { STRIPE_WEBHOOK_SERVICE } from "./services/stripe-webhook.service.interface";

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    AuditModule,
    AuthModule,
    ProductsModule,
  ],
  controllers: [OrdersController, StripeWebhookController],
  providers: [
    OrderRepository,
    {
      provide: ORDER_REPOSITORY,
      useClass: OrderRepository,
    },
    MockPaymentGatewayService,
    StripePaymentService,
    {
      provide: PAYMENT_GATEWAY_SERVICE,
      useFactory: (envService: EnvService) => {
        if (envService.stripeSecretKey) {
          return new StripePaymentService(envService);
        }
        return new MockPaymentGatewayService();
      },
      inject: [EnvService],
    },
    CheckoutService,
    {
      provide: CHECKOUT_SERVICE,
      useClass: CheckoutService,
    },
    StripeWebhookService,
    {
      provide: STRIPE_WEBHOOK_SERVICE,
      useClass: StripeWebhookService,
    },
  ],
  exports: [
    OrderRepository,
    ORDER_REPOSITORY,
    CheckoutService,
    CHECKOUT_SERVICE,
    PAYMENT_GATEWAY_SERVICE,
    StripeWebhookService,
    STRIPE_WEBHOOK_SERVICE,
  ],
})
export class OrdersModule {}
