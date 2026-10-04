import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma";
import { AuditModule } from "../audit";
import { AuthModule } from "../auth";
import { ProductRepository } from "./repositories/product.repository";
import { PRODUCT_REPOSITORY } from "./repositories/product.repository.interface";
import { ProductsService } from "./services/products.service";
import { PRODUCTS_SERVICE } from "./services/products.service.interface";
import { ProductsController } from "./products.controller";

@Module({
  imports: [PrismaModule, AuditModule, AuthModule],
  controllers: [ProductsController],
  providers: [
    ProductRepository,
    {
      provide: PRODUCT_REPOSITORY,
      useClass: ProductRepository,
    },
    ProductsService,
    {
      provide: PRODUCTS_SERVICE,
      useClass: ProductsService,
    },
  ],
  exports: [
    ProductRepository,
    PRODUCT_REPOSITORY,
    ProductsService,
    PRODUCTS_SERVICE,
  ],
})
export class ProductsModule {}
