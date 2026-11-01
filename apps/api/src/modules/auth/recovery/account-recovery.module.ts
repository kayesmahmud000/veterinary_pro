import { Module } from "@nestjs/common";
import { AppConfigModule } from "../../../config/config.module";
import { AuthModule } from "../auth.module";
import { AccountRecoveryController } from "./account-recovery.controller";
import { AccountRecoveryService } from "./account-recovery.service";
import { ACCOUNT_RECOVERY_SERVICE } from "./account-recovery.service.interface";
import { AccountRecoveryRepository } from "./account-recovery.repository";
import { AccountRecoveryLifecycleService } from "./account-recovery.lifecycle";
import { AccountRecoverySecrets } from "./account-recovery.secrets";
import { UsersModule } from "../../users/users.module";
import { CryptoModule } from "../../../common/crypto/crypto.module";
import { AuditModule } from "../../audit/audit.module";
import { PrismaModule } from "../../prisma/prisma.module";

@Module({
  imports: [AppConfigModule, AuthModule, UsersModule, CryptoModule, AuditModule, PrismaModule],
  controllers: [AccountRecoveryController],
  providers: [AccountRecoveryRepository, AccountRecoveryLifecycleService, AccountRecoverySecrets,
    { provide: ACCOUNT_RECOVERY_SERVICE, useClass: AccountRecoveryService }],
})
export class AccountRecoveryModule {}
