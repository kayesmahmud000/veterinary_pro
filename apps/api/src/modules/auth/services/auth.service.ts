import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  AuthUserSummary,
  LoginRequestDto,
  LoginResponseDto,
  RefreshTokenResponseDto,
  RegisterRequestDto,
  RegisterResponseDto,
  UserRole,
} from "@vetralink/shared-types";
import {
  ClientMetadata,
  IAuthService,
} from "./auth.service.interface";
import {
  IUserRepository,
  USER_REPOSITORY,
} from "../../users/repositories/user.repository.interface";
import {
  IRefreshTokenRepository,
  REFRESH_TOKEN_REPOSITORY,
} from "../repositories/refresh-token.repository.interface";
import {
  IPasswordHasher,
  PASSWORD_HASHER,
} from "./password-hasher.interface";
import {
  ITokenService,
  TOKEN_SERVICE,
} from "./token.service.interface";
import {
  ITransactionManager,
  TRANSACTION_MANAGER,
} from "../../prisma/interfaces/transaction.interface";
import { PiiCryptoService } from "../../../common/crypto/pii-crypto.service";
import { UserEntity } from "../../users/entities/user.entity";
import { RefreshTokenEntity } from "../entities/refresh-token.entity";
import {
  EntityConflictException,
  ForbiddenOperationException,
  UnauthorizedDomainException,
} from "../../../common/exceptions/domain.exception";

@Injectable()
export class AuthService implements IAuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokenRepository: IRefreshTokenRepository,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: IPasswordHasher,
    @Inject(TOKEN_SERVICE)
    private readonly tokenService: ITokenService,
    @Inject(TRANSACTION_MANAGER)
    private readonly transactionManager: ITransactionManager,
    private readonly piiCryptoService: PiiCryptoService
  ) {}

  public async register(
    dto: RegisterRequestDto,
    meta?: ClientMetadata
  ): Promise<RegisterResponseDto> {
    const requestedRole = dto.role ?? UserRole.FARMER;

    if (
      requestedRole === UserRole.SUPER_ADMIN ||
      requestedRole === UserRole.ADMIN
    ) {
      throw new ForbiddenOperationException(
        "Registration for administrative roles is prohibited."
      );
    }

    const emailExists = await this.userRepository.existsByEmail(dto.email);
    if (emailExists) {
      throw new EntityConflictException(
        `User with email '${dto.email}' already exists.`,
        "email"
      );
    }

    let phoneHash: string | null = null;
    if (dto.phone) {
      phoneHash = this.piiCryptoService.hashPhone(dto.phone);
      const phoneExists = await this.userRepository.existsByPhoneHash(
        phoneHash
      );
      if (phoneExists) {
        throw new EntityConflictException(
          "User with this phone number already exists.",
          "phone"
        );
      }
    }

    const passwordHash = await this.passwordHasher.hash(dto.password);

    const user = UserEntity.create({
      email: dto.email,
      name: dto.name,
      passwordHash,
      role: requestedRole,
      phone: dto.phone,
      phoneHash,
    });

    const tokens = await this.tokenService.generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
    });

    const tokenHash = this.tokenService.hashRefreshToken(tokens.refreshToken);
    const refreshTokenEntity = RefreshTokenEntity.create({
      userId: user.id,
      tokenHash,
      expiresAt: this.tokenService.getRefreshTokenExpiresAt(),
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    await this.transactionManager.run(async (tx) => {
      await this.userRepository.create(user, tx);
      await this.refreshTokenRepository.create(refreshTokenEntity, tx);
    });

    this.logger.log(`New user registered [${user.email}] with role ${user.role}`);

    return {
      user: this.toAuthUserSummary(user),
      tokens,
    };
  }

  public async login(
    dto: LoginRequestDto,
    meta?: ClientMetadata
  ): Promise<LoginResponseDto> {
    let user: UserEntity | null = null;

    if (dto.email) {
      user = await this.userRepository.findByEmail(dto.email);
    } else if (dto.phone) {
      const phoneHash = this.piiCryptoService.hashPhone(dto.phone);
      user = await this.userRepository.findByPhoneHash(phoneHash);
    }

    if (!user) {
      throw new UnauthorizedDomainException("Invalid email or password.");
    }

    if (user.isSuspended()) {
      throw new ForbiddenOperationException("Account has been suspended.");
    }

    if (user.isDeleted()) {
      throw new UnauthorizedDomainException("Invalid email or password.");
    }

    const isPasswordValid = await this.passwordHasher.compare(
      dto.password,
      user.passwordHash
    );

    if (!isPasswordValid) {
      throw new UnauthorizedDomainException("Invalid email or password.");
    }

    user.recordLogin();

    const tokens = await this.tokenService.generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
    });

    const tokenHash = this.tokenService.hashRefreshToken(tokens.refreshToken);
    const refreshTokenEntity = RefreshTokenEntity.create({
      userId: user.id,
      tokenHash,
      expiresAt: this.tokenService.getRefreshTokenExpiresAt(),
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    await this.transactionManager.run(async (tx) => {
      await this.userRepository.update(user, tx);
      await this.refreshTokenRepository.create(refreshTokenEntity, tx);
    });

    this.logger.log(`User logged in [${user.email}]`);

    return {
      user: this.toAuthUserSummary(user),
      tokens,
    };
  }

  public async refreshToken(
    refreshToken: string,
    meta?: ClientMetadata
  ): Promise<RefreshTokenResponseDto> {
    if (!refreshToken || refreshToken.trim().length === 0) {
      throw new UnauthorizedDomainException("Refresh token cannot be empty.");
    }

    const tokenHash = this.tokenService.hashRefreshToken(refreshToken);
    const existingToken =
      await this.refreshTokenRepository.findByTokenHash(tokenHash);

    if (!existingToken) {
      throw new UnauthorizedDomainException("Invalid refresh token.");
    }

    // Refresh Token Reuse Detection
    if (existingToken.isRevoked()) {
      this.logger.warn(
        `Refresh token reuse detected for user ${existingToken.userId}. Revoking all sessions.`
      );
      await this.refreshTokenRepository.revokeAllForUser(existingToken.userId);
      throw new UnauthorizedDomainException(
        "Refresh token reuse detected. All sessions have been revoked."
      );
    }

    if (existingToken.isExpired()) {
      throw new UnauthorizedDomainException("Refresh token has expired.");
    }

    const user = await this.userRepository.findById(existingToken.userId);
    if (!user || user.isSuspended() || user.isDeleted()) {
      throw new UnauthorizedDomainException("User session is no longer active.");
    }

    const newTokens = await this.tokenService.generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
    });

    const newTokenHash = this.tokenService.hashRefreshToken(
      newTokens.refreshToken
    );

    const newRefreshTokenEntity = RefreshTokenEntity.create({
      userId: user.id,
      tokenHash: newTokenHash,
      expiresAt: this.tokenService.getRefreshTokenExpiresAt(),
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    await this.transactionManager.run(async (tx) => {
      await this.refreshTokenRepository.revoke(existingToken.id, new Date(), tx);
      await this.refreshTokenRepository.create(newRefreshTokenEntity, tx);
    });

    return {
      tokens: newTokens,
    };
  }

  public async logout(refreshToken: string): Promise<void> {
    if (!refreshToken || refreshToken.trim().length === 0) {
      return;
    }
    const tokenHash = this.tokenService.hashRefreshToken(refreshToken);
    await this.refreshTokenRepository.revokeByTokenHash(tokenHash);
  }

  public async logoutAll(userId: string): Promise<void> {
    if (!userId || userId.trim().length === 0) {
      return;
    }
    await this.refreshTokenRepository.revokeAllForUser(userId);
  }

  private toAuthUserSummary(user: UserEntity): AuthUserSummary {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      isEmailVerified: user.isEmailVerified,
      maskedPhone: user.maskPhone(),
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
