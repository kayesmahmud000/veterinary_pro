import { Global, Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service";
import { TransactionManager } from "./transaction/transaction.manager";
import { TRANSACTION_MANAGER } from "./interfaces/transaction.interface";

@Global()
@Module({
  providers: [
    PrismaService,
    TransactionManager,
    {
      provide: TRANSACTION_MANAGER,
      useExisting: TransactionManager,
    },
  ],
  exports: [PrismaService, TransactionManager, TRANSACTION_MANAGER],
})
export class PrismaModule {}
