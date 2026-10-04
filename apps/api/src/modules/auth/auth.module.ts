import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AppConfigModule } from "../../config/config.module";
import { EnvService } from "../../config/env.service";
import { CryptoModule } from "../../common/crypto/crypto.module";
import { UsersModule } from "../users/users.module";
import { RefreshTokenRepository } from "./repositories/refresh-token.repository";
import { REFRESH_TOKEN_REPOSITORY } from "./repositories/refresh-token.repository.interface";
import { BcryptPasswordHasher } from "./services/bcrypt-password-hasher.service";
import { PASSWORD_HASHER } from "./services/password-hasher.interface";
import { TokenService } from "./services/token.service";
import { TOKEN_SERVICE } from "./services/token.service.interface";
import { AuthService } from "./services/auth.service";
import { AUTH_SERVICE } from "./services/auth.service.interface";
import { AuthController } from "./auth.controller";

@Module({
  imports: [
    AppConfigModule,
    CryptoModule,
    UsersModule,
    JwtModule.registerAsync({
      imports: [AppConfigModule],
      inject: [EnvService],
      useFactory: (envService: EnvService) => ({
        secret: envService.jwtAccessSecret,
        signOptions: {
          expiresIn: envService.jwtAccessExpiration,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    RefreshTokenRepository,
    {
      provide: REFRESH_TOKEN_REPOSITORY,
      useClass: RefreshTokenRepository,
    },
    BcryptPasswordHasher,
    {
      provide: PASSWORD_HASHER,
      useClass: BcryptPasswordHasher,
    },
    TokenService,
    {
      provide: TOKEN_SERVICE,
      useClass: TokenService,
    },
    AuthService,
    {
      provide: AUTH_SERVICE,
      useClass: AuthService,
    },
  ],
  exports: [
    RefreshTokenRepository,
    REFRESH_TOKEN_REPOSITORY,
    BcryptPasswordHasher,
    PASSWORD_HASHER,
    TokenService,
    TOKEN_SERVICE,
    AuthService,
    AUTH_SERVICE,
    JwtModule,
  ],
})
export class AuthModule {}
