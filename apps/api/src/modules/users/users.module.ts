import { Module } from "@nestjs/common";
import { CryptoModule } from "../../common/crypto/crypto.module";
import { UserRepository } from "./repositories/user.repository";
import { USER_REPOSITORY } from "./repositories/user.repository.interface";

@Module({
  imports: [CryptoModule],
  providers: [
    UserRepository,
    {
      provide: USER_REPOSITORY,
      useClass: UserRepository,
    },
  ],
  exports: [UserRepository, USER_REPOSITORY],
})
export class UsersModule {}
