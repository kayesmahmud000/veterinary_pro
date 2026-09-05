import { Module } from "@nestjs/common";
import { UsersModule } from "../users/users.module";
import { RefreshTokenRepository } from "./repositories/refresh-token.repository";
import { REFRESH_TOKEN_REPOSITORY } from "./repositories/refresh-token.repository.interface";

@Module({
  imports: [UsersModule],
  providers: [
    RefreshTokenRepository,
    {
      provide: REFRESH_TOKEN_REPOSITORY,
      useClass: RefreshTokenRepository,
    },
  ],
  exports: [RefreshTokenRepository, REFRESH_TOKEN_REPOSITORY],
})
export class AuthModule {}
