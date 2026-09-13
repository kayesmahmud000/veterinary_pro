import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  ConfirmAttachmentUploadDto,
  HealthAttachmentStatus,
  HealthRecordAttachmentResponseDto,
  PresignedAttachmentUploadResponseDto,
  RequestAttachmentPresignedUrlDto,
} from "@vetralink/shared-types";
import { EnvService } from "../../../config/env.service";
import { EntityNotFoundException } from "../../../common/exceptions/domain.exception";
import {
  AUDIT_LOG_REPOSITORY,
  IAuditLogRepository,
} from "../../audit/repositories/audit-log.repository.interface";
import {
  ITransactionManager,
  TRANSACTION_MANAGER,
} from "../../prisma/interfaces/transaction.interface";
import {
  IS3StorageService,
  S3_STORAGE_SERVICE,
} from "../../media/services/s3-storage.service.interface";
import { HealthRecordAttachmentEntity } from "../entities/health-record-attachment.entity";
import {
  HEALTH_RECORD_REPOSITORY,
  IHealthRecordRepository,
} from "../repositories/health-record.repository.interface";
import {
  HEALTH_RECORD_ATTACHMENT_REPOSITORY,
  IHealthRecordAttachmentRepository,
} from "../repositories/health-record-attachment.repository.interface";
import { IHealthAttachmentService } from "./health-attachment.service.interface";

@Injectable()
export class HealthAttachmentService implements IHealthAttachmentService {
  private readonly logger = new Logger(HealthAttachmentService.name);

  constructor(
    @Inject(HEALTH_RECORD_REPOSITORY)
    private readonly healthRecordRepository: IHealthRecordRepository,
    @Inject(HEALTH_RECORD_ATTACHMENT_REPOSITORY)
    private readonly healthAttachmentRepository: IHealthRecordAttachmentRepository,
    @Inject(S3_STORAGE_SERVICE)
    private readonly s3StorageService: IS3StorageService,
    @Inject(AUDIT_LOG_REPOSITORY)
    private readonly auditLogRepository: IAuditLogRepository,
    @Inject(TRANSACTION_MANAGER)
    private readonly transactionManager: ITransactionManager,
    private readonly envService: EnvService
  ) {}

  public async generateUploadPresignedUrl(
    farmId: string,
    healthRecordId: string,
    userId: string,
    dto: RequestAttachmentPresignedUrlDto
  ): Promise<PresignedAttachmentUploadResponseDto> {
    const incident = await this.healthRecordRepository.findById(
      healthRecordId,
      farmId
    );

    if (!incident) {
      throw new EntityNotFoundException("HealthRecord", healthRecordId);
    }

    const attachmentId = crypto.randomUUID();
    const safeFileName = this.sanitizeFileName(dto.fileName);
    const s3Key = `farms/${farmId}/health-records/${healthRecordId}/attachments/${attachmentId}-${safeFileName}`;
    const expiresInSeconds = 900; // 15 minutes

    const uploadUrl = await this.s3StorageService.getPresignedPutUrl(
      this.envService.s3BucketMedia,
      s3Key,
      dto.mimeType,
      expiresInSeconds
    );

    const attachmentEntity = HealthRecordAttachmentEntity.create({
      id: attachmentId,
      farmId,
      healthRecordId,
      uploadedById: userId,
      fileName: safeFileName,
      fileSizeBytes: dto.fileSizeBytes,
      mimeType: dto.mimeType,
      s3Key,
      caption: dto.caption,
    });

    await this.healthAttachmentRepository.create(attachmentEntity);

    this.logger.log(
      `Generated presigned upload URL for health record ${healthRecordId} attachment ${attachmentId} [farm: ${farmId}]`
    );

    return {
      attachmentId,
      uploadUrl,
      s3Key,
      expiresInSeconds,
    };
  }

  public async confirmUpload(
    farmId: string,
    healthRecordId: string,
    attachmentId: string,
    dto?: ConfirmAttachmentUploadDto
  ): Promise<HealthRecordAttachmentResponseDto> {
    const incident = await this.healthRecordRepository.findById(
      healthRecordId,
      farmId
    );

    if (!incident) {
      throw new EntityNotFoundException("HealthRecord", healthRecordId);
    }

    const attachment = await this.healthAttachmentRepository.findById(
      attachmentId,
      farmId
    );

    if (!attachment || attachment.healthRecordId !== healthRecordId) {
      throw new EntityNotFoundException(
        "HealthRecordAttachment",
        attachmentId
      );
    }

    attachment.confirm(dto?.caption);
    const saved = await this.healthAttachmentRepository.update(attachment);

    const viewUrl = await this.s3StorageService.getPresignedGetUrl(
      this.envService.s3BucketMedia,
      saved.s3Key,
      3600
    );

    this.logger.log(
      `Confirmed upload for health record attachment ${attachmentId} [farm: ${farmId}]`
    );

    return saved.toResponseDto(viewUrl);
  }

  public async listAttachments(
    farmId: string,
    healthRecordId: string
  ): Promise<HealthRecordAttachmentResponseDto[]> {
    const incident = await this.healthRecordRepository.findById(
      healthRecordId,
      farmId
    );

    if (!incident) {
      throw new EntityNotFoundException("HealthRecord", healthRecordId);
    }

    const attachments =
      await this.healthAttachmentRepository.findByIncidentId(
        healthRecordId,
        farmId,
        HealthAttachmentStatus.CONFIRMED
      );

    return Promise.all(
      attachments.map(async (att) => {
        const viewUrl = await this.s3StorageService.getPresignedGetUrl(
          this.envService.s3BucketMedia,
          att.s3Key,
          3600
        );
        return att.toResponseDto(viewUrl);
      })
    );
  }

  public async getAttachmentViewUrl(
    farmId: string,
    healthRecordId: string,
    attachmentId: string
  ): Promise<HealthRecordAttachmentResponseDto> {
    const incident = await this.healthRecordRepository.findById(
      healthRecordId,
      farmId
    );

    if (!incident) {
      throw new EntityNotFoundException("HealthRecord", healthRecordId);
    }

    const attachment = await this.healthAttachmentRepository.findById(
      attachmentId,
      farmId
    );

    if (!attachment || attachment.healthRecordId !== healthRecordId) {
      throw new EntityNotFoundException(
        "HealthRecordAttachment",
        attachmentId
      );
    }

    const viewUrl = await this.s3StorageService.getPresignedGetUrl(
      this.envService.s3BucketMedia,
      attachment.s3Key,
      3600
    );

    return attachment.toResponseDto(viewUrl);
  }

  public async deleteAttachment(
    farmId: string,
    healthRecordId: string,
    attachmentId: string,
    userId: string,
    traceId?: string
  ): Promise<void> {
    const activeTraceId = traceId ?? crypto.randomUUID();

    const incident = await this.healthRecordRepository.findById(
      healthRecordId,
      farmId
    );

    if (!incident) {
      throw new EntityNotFoundException("HealthRecord", healthRecordId);
    }

    const attachment = await this.healthAttachmentRepository.findById(
      attachmentId,
      farmId
    );

    if (!attachment || attachment.healthRecordId !== healthRecordId) {
      throw new EntityNotFoundException(
        "HealthRecordAttachment",
        attachmentId
      );
    }

    // 1. Delete object from S3 (best-effort, non-blocking if storage missing)
    try {
      await this.s3StorageService.deleteObject(
        this.envService.s3BucketMedia,
        attachment.s3Key
      );
    } catch (error) {
      this.logger.warn(
        `Failed to delete S3 object '${attachment.s3Key}' during attachment cleanup: ${(error as Error).message}`
      );
    }

    // 2. Delete database record & audit log
    const oldValues = attachment.toResponseDto() as unknown as Record<
      string,
      unknown
    >;

    await this.transactionManager.run(async (tx) => {
      await this.healthAttachmentRepository.delete(attachmentId, farmId, tx);

      await this.auditLogRepository.record(
        {
          userId,
          action: "HEALTH_RECORD_ATTACHMENT_DELETED",
          entityType: "HealthRecordAttachment",
          entityId: attachmentId,
          oldValues,
          traceId: activeTraceId,
        },
        tx
      );
    });

    this.logger.log(
      `Deleted health record attachment ${attachmentId} [farm: ${farmId}]`
    );
  }

  private sanitizeFileName(fileName: string): string {
    const lastDot = fileName.lastIndexOf(".");
    let ext = "";
    let base = fileName;

    if (lastDot > 0) {
      ext = fileName.substring(lastDot).toLowerCase().replace(/[^a-z0-9.]/g, "");
      base = fileName.substring(0, lastDot);
    }

    const cleanBase = base
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    const safeName = (cleanBase || "image") + (ext || ".jpg");
    return safeName.substring(0, 100);
  }
}
