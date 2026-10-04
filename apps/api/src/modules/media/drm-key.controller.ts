import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { Response, Request } from "express";
import {
  DrmPlaybackTokenResponseDto,
  JwtPayload,
} from "@vetralink/shared-types";
import { CurrentUser, ResponseMessage } from "../../common/decorators";
import { JwtAuthGuard } from "../../common/guards";
import {
  ForbiddenOperationException,
  UnauthorizedDomainException,
} from "../../common/exceptions/domain.exception";
import { DrmPlaybackTokenDto } from "./dto/drm-playback-token.dto";
import {
  IDrmKeyService,
  DRM_KEY_SERVICE,
} from "./services/drm-key.service.interface";
import {
  IDrmTokenService,
  DRM_TOKEN_SERVICE,
} from "./services/drm-token.service.interface";
import {
  IEntitlementService,
  ENTITLEMENT_SERVICE,
} from "./services/entitlement.service.interface";
import { EnvService } from "../../config/env.service";

@ApiTags("Media DRM & HLS Key Server")
@Controller("media")
export class DrmKeyController {
  constructor(
    @Inject(DRM_KEY_SERVICE)
    private readonly drmKeyService: IDrmKeyService,
    @Inject(DRM_TOKEN_SERVICE)
    private readonly drmTokenService: IDrmTokenService,
    @Inject(ENTITLEMENT_SERVICE)
    private readonly entitlementService: IEntitlementService,
    private readonly envService: EnvService
  ) {}

  @Post("drm/playback-token")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Generate an ephemeral time-bound DRM playback token for a video course",
    description:
      "Validates user purchase / subscription entitlement and emits a 10-minute signed token and player key URI.",
  })
  @ApiOkResponse({
    description: "DRM playback token successfully generated.",
  })
  @ApiUnauthorizedResponse({ description: "Missing or invalid bearer token." })
  @ApiForbiddenResponse({
    description:
      "User is not entitled to stream this product (not purchased and no subscription).",
  })
  @ApiNotFoundResponse({
    description: "Product does not exist or is unpublished.",
  })
  @ResponseMessage("DRM playback token generated successfully.")
  public async generatePlaybackToken(
    @CurrentUser() user: JwtPayload,
    @Body() dto: DrmPlaybackTokenDto,
    @Req() req: Request
  ): Promise<DrmPlaybackTokenResponseDto> {
    const isEntitled = await this.entitlementService.checkEntitlement(
      user.sub,
      user.role,
      dto.productId
    );

    if (!isEntitled) {
      throw new ForbiddenOperationException(
        "You do not have entitlement to stream this video product. Please purchase the course or upgrade your subscription."
      );
    }

    const { token, expiresAt, expiresInSeconds } =
      await this.drmTokenService.generatePlaybackToken(
        user.sub,
        dto.productId,
        user.role
      );

    const protocol = req.protocol || "http";
    const host = req.get("host") || `localhost:${this.envService.port}`;
    const keyUrl = `${protocol}://${host}/api/v1/media/drm/key/${token}`;

    return {
      playbackToken: token,
      keyUrl,
      expiresAt: expiresAt.toISOString(),
      expiresInSeconds,
    };
  }

  @Get("drm/key/:playbackToken")
  @ApiOperation({
    summary: "Fetch 16-byte raw AES-128 decryption key via path parameter",
    description:
      "Called by HLS client player (Video.js, iOS AVPlayer, etc.) to decrypt video segments.",
  })
  @ApiProduces("application/octet-stream")
  @ApiOkResponse({
    description: "16-byte binary decryption key emitted.",
  })
  @ApiUnauthorizedResponse({
    description: "Playback token expired, invalid, or forged.",
  })
  public async getKeyByPathParam(
    @Param("playbackToken") playbackToken: string,
    @Res() res: Response
  ): Promise<void> {
    await this.deliverDecryptionKey(playbackToken, res);
  }

  @Get("drm/key")
  @ApiOperation({
    summary: "Fetch 16-byte raw AES-128 decryption key via query parameter",
    description:
      "Alternative endpoint allowing players using URI parameter queries (?token=...) to fetch keys.",
  })
  @ApiProduces("application/octet-stream")
  @ApiOkResponse({
    description: "16-byte binary decryption key emitted.",
  })
  @ApiUnauthorizedResponse({
    description: "Playback token expired, invalid, or missing.",
  })
  public async getKeyByQueryParam(
    @Query("token") token: string | undefined,
    @Res() res: Response
  ): Promise<void> {
    if (!token) {
      throw new UnauthorizedDomainException(
        "Query parameter 'token' is required for DRM key retrieval."
      );
    }
    await this.deliverDecryptionKey(token, res);
  }

  @Get("key/:playbackToken")
  @ApiOperation({
    summary: "Fetch 16-byte raw AES-128 decryption key (Architecture direct alias)",
    description:
      "Direct alias matching /api/v1/media/key/:playbackToken as specified in ARCHITECTURE.md.",
  })
  @ApiProduces("application/octet-stream")
  public async getKeyDirectAlias(
    @Param("playbackToken") playbackToken: string,
    @Res() res: Response
  ): Promise<void> {
    await this.deliverDecryptionKey(playbackToken, res);
  }

  private async deliverDecryptionKey(
    token: string,
    res: Response
  ): Promise<void> {
    const payload = await this.drmTokenService.verifyPlaybackToken(token);
    const rawKey = this.drmKeyService.deriveKey(payload.pid);

    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Length", rawKey.length.toString());
    res.setHeader(
      "Cache-Control",
      "private, no-cache, no-store, must-revalidate"
    );
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    res.status(HttpStatus.OK).end(rawKey);
  }
}
