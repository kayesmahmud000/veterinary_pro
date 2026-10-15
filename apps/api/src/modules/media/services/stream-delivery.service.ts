import { Inject, Injectable, Logger } from "@nestjs/common";
import { ProductType, UserRole } from "@vetralink/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import {
  EntityNotFoundException,
  ForbiddenOperationException,
  ValidationDomainException,
} from "../../../common/exceptions/domain.exception";
import {
  IStreamDeliveryService,
  StreamSessionResult,
} from "./stream-delivery.service.interface";
import {
  ICloudFrontSignerService,
  CLOUDFRONT_SIGNER_SERVICE,
} from "./cloudfront-signer.service.interface";
import {
  IDrmTokenService,
  DRM_TOKEN_SERVICE,
} from "./drm-token.service.interface";
import {
  IEntitlementService,
  ENTITLEMENT_SERVICE,
} from "./entitlement.service.interface";
import { EnvService } from "../../../config/env.service";
import { z } from "zod";

@Injectable()
export class StreamDeliveryService implements IStreamDeliveryService {
  private readonly logger = new Logger(StreamDeliveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(ENTITLEMENT_SERVICE)
    private readonly entitlementService: IEntitlementService,
    @Inject(CLOUDFRONT_SIGNER_SERVICE)
    private readonly cloudfrontSignerService: ICloudFrontSignerService,
    @Inject(DRM_TOKEN_SERVICE)
    private readonly drmTokenService: IDrmTokenService,
    private readonly envService: EnvService
  ) {}

  public async createPlaybackSession(
    userId: string,
    userRole: string,
    productId: string,
    hostHeader?: string,
    protocol?: string
  ): Promise<StreamSessionResult> {
    // 1. Fetch product and validate existence and publication status
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product || product.deletedAt) {
      throw new EntityNotFoundException(
        `Product with ID [${productId}] was not found.`
      );
    }

    if (
      !product.isPublished &&
      userRole !== UserRole.SUPER_ADMIN &&
      userRole !== UserRole.ADMIN
    ) {
      throw new EntityNotFoundException(
        `Product with ID [${productId}] is not published.`
      );
    }

    if (product.type !== ProductType.VIDEO_COURSE) {
      throw new ValidationDomainException(
        `Product [${productId}] is of type [${product.type}], not [VIDEO_COURSE]. Stream playback is only supported for video courses.`
      );
    }

    // Claimed legacy products retain their existing playlist; new uploads use
    // an isolated prefix so a session cannot authorize another asset version.
    let playlistKey = `hls/${productId}/master.m3u8`;
    const metadata = product.metadata;
    if (
      metadata && typeof metadata === "object" &&
      !Array.isArray(metadata) && metadata.adminManaged === true
    ) {
      const segments = product.contentS3Key.split("/");
      const validPrefix = segments[0] === "hls" && segments[1] === productId;
      const legacyPlaylist = segments.length === 3 && segments[2] === "master.m3u8";
      const managedPlaylist = segments.length === 4 &&
        z.string().uuid().safeParse(segments[2]).success &&
        segments[3] === "master.m3u8";
      if (!validPrefix || (!legacyPlaylist && !managedPlaylist)) {
        throw new ValidationDomainException("This video does not have a ready attached playlist.");
      }
      playlistKey = product.contentS3Key;
    }

    // 2. Validate entitlement
    const isEntitled = await this.entitlementService.checkEntitlement(
      userId,
      userRole,
      productId
    );

    if (!isEntitled) {
      throw new ForbiddenOperationException(
        "You do not have entitlement to stream this video product. Please purchase the course or upgrade your subscription."
      );
    }

    // 3. Generate DRM playback token & key URL
    const { token, expiresAt, expiresInSeconds } =
      await this.drmTokenService.generatePlaybackToken(
        userId,
        productId,
        userRole
      );

    const proto = protocol || "http";
    const host = hostHeader || `localhost:${this.envService.port}`;
    const drmKeyUrl = `${proto}://${host}/api/v1/media/drm/key/${token}`;

    // 4. Construct CloudFront streaming paths
    const cdnBaseUrl = this.cloudfrontSignerService.getStreamBaseUrl();
    const resourcePattern = `${cdnBaseUrl}/${playlistKey.slice(0, playlistKey.lastIndexOf("/"))}/*`;
    const masterPlaylistUrl = `${cdnBaseUrl}/${playlistKey}`;

    // 5. Generate signed URL (with custom wildcard policy) and signed cookies
    const signedStreamUrl = this.cloudfrontSignerService.signUrlCustomPolicy(
      resourcePattern,
      masterPlaylistUrl,
      expiresInSeconds
    );

    const signedCookies = this.cloudfrontSignerService.generateSignedCookies(
      resourcePattern,
      expiresInSeconds
    );

    this.logger.log(
      `Stream playback session provisioned for user [${userId}] on product [${productId}]. Expires in ${expiresInSeconds}s.`
    );

    return {
      productId,
      streamUrl: signedStreamUrl,
      drmKeyUrl,
      cookies: signedCookies,
      expiresAt,
      expiresInSeconds,
    };
  }
}
