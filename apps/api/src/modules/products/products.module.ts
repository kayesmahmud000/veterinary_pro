import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma";
import { AuditModule } from "../audit";
import { AuthModule } from "../auth";
import { ProductRepository } from "./repositories/product.repository";
import { PRODUCT_REPOSITORY } from "./repositories/product.repository.interface";
import { ProductsService } from "./services/products.service";
import { PRODUCTS_SERVICE } from "./services/products.service.interface";
import { ProductsController } from "./products.controller";

import { UsersModule } from "../users/users.module";
import { AdminProductsRepository } from "./admin-products.repository";
import { AdminProductsService } from "./admin-products.service";
import { AdminProductsController } from "./admin-products.controller";
@Module({
  imports: [PrismaModule, AuditModule, AuthModule, UsersModule],
  controllers: [ProductsController, AdminProductsController],
  providers: [AdminProductsRepository, AdminProductsService,
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
  exports: [AdminProductsService,
    ProductRepository,
    PRODUCT_REPOSITORY,
    ProductsService,
    PRODUCTS_SERVICE,
  ],
})
export class ProductsModule {}
