import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import {
  CompleteMultipartUploadResponseDto,
  DirectUploadResponseDto,
  GetPresignedPartUrlResponseDto,
  InitiateMultipartUploadResponseDto,
  JwtPayload,
  QueueTranscodeResponseDto,
  TranscodeJobStatusResponseDto,
  TranscodeStatus,
  UserRole,
} from "@vetralink/shared-types";
import { CurrentUser, ResponseMessage, Roles } from "../../common/decorators";
import { JwtAuthGuard, RolesGuard } from "../../common/guards";
import {
  AbortMultipartUploadDto,
  CompleteMultipartUploadDto,
  DirectUploadDto,
  GetPresignedPartUrlDto,
  InitiateMultipartUploadDto,
  QueueTranscodeDto,
} from "./dto";
import {
  IMediaUploadService,
  MEDIA_UPLOAD_SERVICE,
} from "./services/media-upload.service.interface";
import {
  IVideoTranscodeQueueService,
  VIDEO_TRANSCODE_QUEUE_SERVICE,
} from "./services/video-transcode-queue.service.interface";
import { EnvService } from "../../config/env.service";
import { EntityNotFoundException } from "../../common/exceptions/domain.exception";

@ApiTags("Media Uploads")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("media/uploads")
export class MediaUploadController {
  constructor(
    @Inject(MEDIA_UPLOAD_SERVICE)
    private readonly mediaUploadService: IMediaUploadService,
    @Inject(VIDEO_TRANSCODE_QUEUE_SERVICE)
    private readonly transcodeQueueService: IVideoTranscodeQueueService,
    private readonly envService: EnvService
  ) {}

  @Post("multipart/initiate")
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VET)
  @ResponseMessage("Multipart upload initiated successfully")
  @ApiOperation({
    summary: "Initiate multipart upload for large video or course assets",
    description:
      "Validates file metadata, calculates optimal chunk sizing, and requests an AWS S3 multipart upload ID.",
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: "Multipart upload initialized with S3 uploadId and chunk specs",
  })
  @ApiUnauthorizedResponse({ description: "Missing or invalid JWT token" })
  @ApiForbiddenResponse({
    description: "Requires SUPER_ADMIN, ADMIN, or VET role",
  })
  public async initiateMultipartUpload(
    @Body() dto: InitiateMultipartUploadDto,
    @CurrentUser() user: JwtPayload
  ): Promise<InitiateMultipartUploadResponseDto> {
    return this.mediaUploadService.initiateMultipartUpload(dto, user.sub);
  }

  @Post("multipart/part-url")
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VET)
  @ResponseMessage("Presigned part URL generated")
  @ApiOperation({
    summary: "Generate presigned PUT URL for a specific multipart part",
    description:
      "Returns a short-lived (1 hour) presigned PUT URL for the requested chunk index.",
  })
  @ApiOkResponse({ description: "Presigned part upload URL" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid JWT token" })
  @ApiForbiddenResponse({
    description: "Requires SUPER_ADMIN, ADMIN, or VET role",
  })
  public async getPresignedPartUrl(
    @Body() dto: GetPresignedPartUrlDto
  ): Promise<GetPresignedPartUrlResponseDto> {
    return this.mediaUploadService.getPresignedPartUrl(dto);
  }

  @Post("multipart/complete")
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VET)
  @ResponseMessage("Multipart upload completed successfully")
  @ApiOperation({
    summary: "Complete multipart upload and assemble chunks in S3",
    description:
      "Directs S3 to stitch uploaded parts together, yielding the final object URI.",
  })
  @ApiOkResponse({
    description: "Multipart upload completed with final location and etag",
  })
  @ApiUnauthorizedResponse({ description: "Missing or invalid JWT token" })
  @ApiForbiddenResponse({
    description: "Requires SUPER_ADMIN, ADMIN, or VET role",
  })
  public async completeMultipartUpload(
    @Body() dto: CompleteMultipartUploadDto,
    @CurrentUser() user: JwtPayload
  ): Promise<CompleteMultipartUploadResponseDto> {
    return this.mediaUploadService.completeMultipartUpload(dto, user.sub);
  }

  @Post("multipart/abort")
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VET)
  @ResponseMessage("Multipart upload aborted successfully")
  @ApiOperation({
    summary: "Abort in-progress multipart upload and purge uncommitted parts",
    description:
      "Cleans up dangling chunks on S3 to prevent storage cost accumulation on client failures.",
  })
  @ApiOkResponse({ description: "Multipart upload aborted" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid JWT token" })
  @ApiForbiddenResponse({
    description: "Requires SUPER_ADMIN, ADMIN, or VET role",
  })
  public async abortMultipartUpload(
    @Body() dto: AbortMultipartUploadDto,
    @CurrentUser() user: JwtPayload
  ): Promise<{ aborted: boolean }> {
    await this.mediaUploadService.abortMultipartUpload(dto, user.sub);
    return { aborted: true };
  }

  @Post("presigned-url")
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VET)
  @ResponseMessage("Direct upload URL generated successfully")
  @ApiOperation({
    summary: "Generate direct presigned PUT URL for single-part files",
    description:
      "Generates a 15-minute presigned PUT URL for lightweight PDFs, Excel sheets, and images.",
  })
  @ApiOkResponse({
    description: "Direct presigned PUT upload URL with key and expiry",
  })
  @ApiUnauthorizedResponse({ description: "Missing or invalid JWT token" })
  @ApiForbiddenResponse({
    description: "Requires SUPER_ADMIN, ADMIN, or VET role",
  })
  public async generateDirectUploadUrl(
    @Body() dto: DirectUploadDto,
    @CurrentUser() user: JwtPayload
  ): Promise<DirectUploadResponseDto> {
    return this.mediaUploadService.generateDirectUploadUrl(dto, user.sub);
  }

  @Post("transcode")
  @HttpCode(HttpStatus.ACCEPTED)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VET)
  @ResponseMessage("Video transcoding job queued successfully")
  @ApiOperation({
    summary: "Manually queue FFmpeg multi-bitrate HLS transcoding job",
    description:
      "Dispatches background worker task to convert raw video master into adaptive HLS stream.",
  })
  @ApiResponse({
    status: HttpStatus.ACCEPTED,
    description: "Transcoding job accepted and queued in BullMQ",
  })
  @ApiUnauthorizedResponse({ description: "Missing or invalid JWT token" })
  @ApiForbiddenResponse({
    description: "Requires SUPER_ADMIN, ADMIN, or VET role",
  })
  public async queueTranscode(
    @Body() dto: QueueTranscodeDto,
    @CurrentUser() user: JwtPayload
  ): Promise<QueueTranscodeResponseDto> {
    const result = await this.transcodeQueueService.dispatchTranscodeJob({
      productId: dto.productId,
      rawS3Key: dto.rawS3Key,
      bucket: this.envService.s3BucketMedia,
      requestedBy: user.sub,
    });

    return {
      jobId: result.jobId,
      productId: dto.productId,
      status: TranscodeStatus.PENDING,
    };
  }

  @Get("transcode/:jobId/status")
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VET)
  @ResponseMessage("Transcoding job status retrieved")
  @ApiOperation({
    summary: "Get current progress and state of a video transcoding job",
    description:
      "Queries BullMQ for active, completed, or failed transcode job metadata.",
  })
  @ApiOkResponse({ description: "Current transcoding job state and progress" })
  @ApiNotFoundResponse({ description: "Job ID not found in queue" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid JWT token" })
  @ApiForbiddenResponse({
    description: "Requires SUPER_ADMIN, ADMIN, or VET role",
  })
  public async getTranscodeStatus(
    @Param("jobId") jobId: string
  ): Promise<TranscodeJobStatusResponseDto> {
    const status = await this.transcodeQueueService.getJobStatus(jobId);
    if (!status) {
      throw new EntityNotFoundException("TranscodeJob", jobId);
    }
    return status;
  }
}

