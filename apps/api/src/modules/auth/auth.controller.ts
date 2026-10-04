import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import {
  AuthUserSummary,
  JwtPayload,
  LoginResponseDto,
  RefreshTokenResponseDto,
  RegisterResponseDto,
} from "@vetralink/shared-types";
import {
  ClientMeta,
  CurrentUser,
  Public,
  ResponseMessage,
} from "../../common/decorators";
import { JwtAuthGuard } from "../../common/guards";
import {
  AUTH_SERVICE,
  ClientMetadata,
  IAuthService,
} from "./services/auth.service.interface";
import {
  IUserRepository,
  USER_REPOSITORY,
} from "../users/repositories/user.repository.interface";
import {
  LoginDto,
  LogoutDto,
  RefreshTokenDto,
  RegisterDto,
} from "./dto";
import { UnauthorizedDomainException } from "../../common/exceptions/domain.exception";

@ApiTags("Authentication")
@Controller("auth")
@UseGuards(JwtAuthGuard)
export class AuthController {
  constructor(
    @Inject(AUTH_SERVICE)
    private readonly authService: IAuthService,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository
  ) {}

  @Post("register")
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage("User registration successful")
  @ApiOperation({ summary: "Register a new user account (Farmer, Vet, Buyer)" })
  @ApiCreatedResponse({ description: "User registered successfully" })
  @ApiConflictResponse({ description: "Email or phone number already registered" })
  @ApiForbiddenResponse({
    description: "Registration for administrative roles is prohibited",
  })
  public async register(
    @Body() dto: RegisterDto,
    @ClientMeta() meta: ClientMetadata
  ): Promise<RegisterResponseDto> {
    return this.authService.register(dto, meta);
  }

  @Post("login")
  @Public()
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("Login successful")
  @ApiOperation({ summary: "Authenticate user via email or phone with password" })
  @ApiOkResponse({ description: "Login successful" })
  @ApiUnauthorizedResponse({ description: "Invalid email or password" })
  @ApiForbiddenResponse({ description: "Account has been suspended" })
  public async login(
    @Body() dto: LoginDto,
    @ClientMeta() meta: ClientMetadata
  ): Promise<LoginResponseDto> {
    return this.authService.login(dto, meta);
  }

  @Post("refresh")
  @Public()
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("Tokens refreshed successfully")
  @ApiOperation({ summary: "Rotate refresh token and issue new token pair" })
  @ApiOkResponse({ description: "Tokens refreshed successfully" })
  @ApiUnauthorizedResponse({
    description: "Invalid, expired, or reused refresh token",
  })
  public async refresh(
    @Body() dto: RefreshTokenDto,
    @ClientMeta() meta: ClientMetadata
  ): Promise<RefreshTokenResponseDto> {
    return this.authService.refreshToken(dto.refreshToken, meta);
  }

  @Post("logout")
  @Public()
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("Logout successful")
  @ApiOperation({ summary: "Revoke single session refresh token" })
  @ApiOkResponse({ description: "Session revoked successfully" })
  public async logout(@Body() dto: LogoutDto): Promise<null> {
    await this.authService.logout(dto.refreshToken);
    return null;
  }

  @Post("logout-all")
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("All sessions revoked successfully")
  @ApiOperation({ summary: "Revoke all active sessions for current user" })
  @ApiOkResponse({ description: "All sessions revoked successfully" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  public async logoutAll(
    @CurrentUser() user: JwtPayload
  ): Promise<null> {
    await this.authService.logoutAll(user.sub);
    return null;
  }

  @Get("me")
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("Profile retrieved successfully")
  @ApiOperation({ summary: "Get current authenticated user profile" })
  @ApiOkResponse({ description: "Profile retrieved successfully" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  public async getProfile(
    @CurrentUser() userPayload: JwtPayload
  ): Promise<AuthUserSummary> {
    const user = await this.userRepository.findById(userPayload.sub);
    if (!user || user.isDeleted() || user.isSuspended()) {
      throw new UnauthorizedDomainException(
        "User profile is unavailable or inactive."
      );
    }

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
