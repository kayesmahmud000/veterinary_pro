import { Inject, Injectable } from "@nestjs/common";
import {
  LoginRequestDto,
  LoginResponseDto,
  RefreshTokenResponseDto,
  RegisterRequestDto,
  RegisterResponseDto,
  PUBLIC_REGISTRATION_ROLES,
  UserRole,
  registerSchema,
} from "@vetralink/shared-types";
import { randomUUID } from "crypto";
import { ClientMetadata, IAuthService } from "./auth.service.interface";
import {
  USER_REPOSITORY,
  IUserRepository,
} from "../../users/repositories/user.repository.interface";
import {
  REFRESH_TOKEN_REPOSITORY,
  IRefreshTokenRepository,
} from "../repositories/refresh-token.repository.interface";
import { PASSWORD_HASHER, IPasswordHasher } from "./password-hasher.interface";
import { TOKEN_SERVICE, ITokenService } from "./token.service.interface";
import {
  TRANSACTION_MANAGER,
  ITransactionManager,
} from "../../prisma/interfaces/transaction.interface";
import {
  AUDIT_LOG_REPOSITORY,
  IAuditLogRepository,
} from "../../audit/repositories/audit-log.repository.interface";
import { PiiCryptoService } from "../../../common/crypto/pii-crypto.service";
import { UserEntity } from "../../users/entities/user.entity";
import { RefreshTokenEntity } from "../entities/refresh-token.entity";
import { toAuthUserSummary } from "../../users/auth-user-summary";
import {
  EntityConflictException,
  ForbiddenOperationException,
  UnauthorizedDomainException,
  ValidationDomainException,
} from "../../../common/exceptions/domain.exception";
import { Prisma } from "@prisma/client";

@Injectable()
export class AuthService implements IAuthService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokens: IRefreshTokenRepository,
    @Inject(PASSWORD_HASHER) private readonly passwords: IPasswordHasher,
    @Inject(TOKEN_SERVICE) private readonly tokens: ITokenService,
    @Inject(TRANSACTION_MANAGER)
    private readonly transactions: ITransactionManager,
    private readonly pii: PiiCryptoService,
    @Inject(AUDIT_LOG_REPOSITORY) private readonly audit: IAuditLogRepository,
  ) {}
  public async register(
    dto: RegisterRequestDto,
    meta?: ClientMetadata,
  ): Promise<RegisterResponseDto> {
    const role = dto.role ?? UserRole.LEARNER;
    if (!(PUBLIC_REGISTRATION_ROLES as readonly UserRole[]).includes(role))
      throw new ForbiddenOperationException(
        "Registration for this role is prohibited.",
      );
    const parsed = registerSchema.safeParse(dto);
    if (!parsed.success)
      throw new ValidationDomainException(
        "Invalid registration fields.",
        parsed.error.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
        })),
      );
    const input = parsed.data;
    if (await this.users.existsByEmail(input.email))
      throw new EntityConflictException(
        "Email is already registered.",
        "email",
      );
    const phoneHash = input.phone ? this.pii.hashPhone(input.phone) : null;
    if (phoneHash && (await this.users.existsByPhoneHash(phoneHash)))
      throw new EntityConflictException(
        "Phone is already registered.",
        "phone",
      );
    const user = UserEntity.create({
      email: input.email,
      name: input.name,
      passwordHash: await this.passwords.hash(input.password),
      role,
      phone: input.phone,
      phoneHash,
    });
    const tokens = await this.transactions.run(async (tx) => {
      await this.users.create(user, tx);
      const pair = await this.createSession(user, tx, meta);
      await this.audit.record(
        {
          userId: user.id,
          action: "USER_REGISTERED",
          entityType: "User",
          entityId: user.id,
          newValues: { role },
          traceId: randomUUID(),
          ipAddress: meta?.ipAddress,
        },
        tx,
      );
      return pair;
    });
    return { user: toAuthUserSummary(user), tokens };
  }
  public async login(
    dto: LoginRequestDto,
    meta?: ClientMetadata,
  ): Promise<LoginResponseDto> {
    const found = dto.email
      ? await this.users.findByEmail(dto.email)
      : dto.phone
        ? await this.users.findByPhoneHash(this.pii.hashPhone(dto.phone))
        : null;
    if (!found || found.isDeleted())
      throw new UnauthorizedDomainException("Invalid email or password.");
    if (found.isSuspended())
      throw new ForbiddenOperationException("Account has been suspended.");
    if (!(await this.passwords.compare(dto.password, found.passwordHash)))
      throw new UnauthorizedDomainException("Invalid email or password.");
    return this.transactions.run(async (tx) => {
      const user = await this.users.lockById(found.id, tx);
      if (
        !user ||
        user.isDeleted() ||
        user.isSuspended() ||
        user.passwordHash !== found.passwordHash
      )
        throw new UnauthorizedDomainException(
          "User session is no longer active.",
        );
      await this.users.recordLogin(user.id, tx);
      return {
        user: toAuthUserSummary(user),
        tokens: await this.createSession(user, tx, meta),
      };
    });
  }
  public async refreshToken(
    rawToken: string,
    meta?: ClientMetadata,
  ): Promise<RefreshTokenResponseDto> {
    if (!rawToken?.trim())
      throw new UnauthorizedDomainException("Refresh token cannot be empty.");
    const hash = this.tokens.hashRefreshToken(rawToken);
    const found = await this.refreshTokens.findByTokenHash(hash);
    if (!found) throw new UnauthorizedDomainException("Invalid refresh token.");
    const result = await this.transactions.run(async (tx) => {
      const user = await this.users.lockById(found.userId, tx);
      const current = await this.refreshTokens.lockByTokenHash(hash, tx);
      if (!user || user.isDeleted() || user.isSuspended() || !current)
        throw new UnauthorizedDomainException(
          "User session is no longer active.",
        );
      if (current.isRevoked()) {
        await this.refreshTokens.revokeAllForUser(user.id, new Date(), tx);
        await this.users.invalidateSessions(user.id, tx);
        return null;
      }
      if (current.isExpired())
        throw new UnauthorizedDomainException("Refresh token has expired.");
      await this.refreshTokens.revoke(current.id, new Date(), tx);
      return { tokens: await this.createSession(user, tx, meta) };
    });
    if (!result)
      throw new UnauthorizedDomainException(
        "Refresh token reuse detected. All sessions have been revoked.",
      );
    return result;
  }
  public async logout(rawToken: string): Promise<void> {
    if (rawToken?.trim())
      await this.refreshTokens.revokeByTokenHash(
        this.tokens.hashRefreshToken(rawToken),
      );
  }
  public async logoutAll(userId: string): Promise<void> {
    if (!userId?.trim()) return;
    await this.transactions.run(async (tx) => {
      await this.users.lockById(userId, tx);
      await this.users.invalidateSessions(userId, tx);
      await this.refreshTokens.revokeAllForUser(userId, new Date(), tx);
    });
  }
  private async createSession(
    user: UserEntity,
    tx: Prisma.TransactionClient,
    meta?: ClientMetadata,
  ) {
    const pair = await this.tokens.generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      authorizationVersion: user.authorizationVersion,
    });
    await this.refreshTokens.create(
      RefreshTokenEntity.create({
        userId: user.id,
        tokenHash: this.tokens.hashRefreshToken(pair.refreshToken),
        expiresAt: this.tokens.getRefreshTokenExpiresAt(),
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
      }),
      tx,
    );
    return pair;
  }
}
