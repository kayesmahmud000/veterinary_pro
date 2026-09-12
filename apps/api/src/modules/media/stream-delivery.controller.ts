import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { Request, Response } from "express";
import {
  JwtPayload,
  StreamPlaybackSessionResponseDto,
} from "@vetralink/shared-types";
import { CurrentUser, ResponseMessage } from "../../common/decorators";
import { JwtAuthGuard } from "../../common/guards";
import { StreamPlaybackSessionDto } from "./dto/stream-session.dto";
import {
  IStreamDeliveryService,
  STREAM_DELIVERY_SERVICE,
} from "./services/stream-delivery.service.interface";

@ApiTags("Media Streaming & CloudFront Delivery")
@Controller("media/stream")
export class StreamDeliveryController {
  constructor(
    @Inject(STREAM_DELIVERY_SERVICE)
    private readonly streamDeliveryService: IStreamDeliveryService
  ) {}

  @Post("session")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Provision a secure HLS streaming playback session",
    description:
      "Validates user entitlement and generates CloudFront signed URL with custom wildcard policy, signed cookies, and DRM key URL.",
  })
  @ApiOkResponse({
    description: "Streaming playback session provisioned successfully.",
  })
  @ApiUnauthorizedResponse({ description: "Missing or invalid bearer token." })
  @ApiForbiddenResponse({
    description:
      "User is not entitled to stream this video product (not purchased and no subscription).",
  })
  @ApiNotFoundResponse({
    description: "Product does not exist or is unpublished.",
  })
  @ResponseMessage("Stream playback session provisioned successfully.")
  public async createSession(
    @CurrentUser() user: JwtPayload,
    @Body() dto: StreamPlaybackSessionDto,
    @Req() req: Request
  ): Promise<StreamPlaybackSessionResponseDto> {
    const protocol = req.protocol || "http";
    const host = req.get("host") || undefined;

    const result = await this.streamDeliveryService.createPlaybackSession(
      user.sub,
      user.role,
      dto.productId,
      host,
      protocol
    );

    return {
      productId: result.productId,
      streamUrl: result.streamUrl,
      drmKeyUrl: result.drmKeyUrl,
      cookies: result.cookies
        ? {
            "CloudFront-Policy": result.cookies.policy,
            "CloudFront-Signature": result.cookies.signature,
            "CloudFront-Key-Pair-Id": result.cookies.keyPairId,
          }
        : undefined,
      expiresAt: result.expiresAt.toISOString(),
      expiresInSeconds: result.expiresInSeconds,
    };
  }

  @Get(":productId/manifest")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Set CloudFront signed cookies and redirect to HLS master playlist",
    description:
      "Direct player launch endpoint that sets HTTP-only signed cookies on the client and 302 redirects to CloudFront master.m3u8.",
  })
  @ApiUnauthorizedResponse({ description: "Missing or invalid bearer token." })
  @ApiForbiddenResponse({
    description: "User is not entitled to stream this product.",
  })
  @ApiNotFoundResponse({
    description: "Product does not exist or is unpublished.",
  })
  public async getManifest(
    @CurrentUser() user: JwtPayload,
    @Param("productId", new ParseUUIDPipe({ version: "4" })) productId: string,
    @Req() req: Request,
    @Res() res: Response
  ): Promise<void> {
    const protocol = req.protocol || "http";
    const host = req.get("host") || undefined;

    const result = await this.streamDeliveryService.createPlaybackSession(
      user.sub,
      user.role,
      productId,
      host,
      protocol
    );

    if (result.cookies) {
      const cookieOptions = {
        httpOnly: true,
        secure: true,
        sameSite: "none" as const,
        maxAge: result.expiresInSeconds * 1000,
        path: `/hls/${productId}`,
      };

      res.cookie("CloudFront-Policy", result.cookies.policy, cookieOptions);
      res.cookie(
        "CloudFront-Signature",
        result.cookies.signature,
        cookieOptions
      );
      res.cookie(
        "CloudFront-Key-Pair-Id",
        result.cookies.keyPairId,
        cookieOptions
      );
    }

    res.redirect(HttpStatus.FOUND, result.streamUrl);
  }
}
