import { HealthAttachmentStatus, HealthEventType } from "@vetralink/shared-types";
import { EnvService } from "../../../config/env.service";
import { EntityNotFoundException } from "../../../common/exceptions/domain.exception";
import { IAuditLogRepository } from "../../audit/repositories/audit-log.repository.interface";
import { ITransactionManager } from "../../prisma/interfaces/transaction.interface";
import { IS3StorageService } from "../../media/services/s3-storage.service.interface";
import { HealthRecordEntity } from "../entities/health-record.entity";
import { HealthRecordAttachmentEntity } from "../entities/health-record-attachment.entity";
import { IHealthRecordRepository } from "../repositories/health-record.repository.interface";
import { IHealthRecordAttachmentRepository } from "../repositories/health-record-attachment.repository.interface";
import { HealthAttachmentService } from "./health-attachment.service";

describe("HealthAttachmentService", () => {
  let service: HealthAttachmentService;
  let healthRecordRepo: jest.Mocked<IHealthRecordRepository>;
  let healthAttachmentRepo: jest.Mocked<IHealthRecordAttachmentRepository>;
  let s3StorageService: jest.Mocked<IS3StorageService>;
  let auditLogRepo: jest.Mocked<IAuditLogRepository>;
  let transactionManager: jest.Mocked<ITransactionManager>;
  let envService: jest.Mocked<EnvService>;

  const farmId = "11111111-1111-1111-1111-111111111111";
  const healthRecordId = "22222222-2222-2222-2222-222222222222";
  const userId = "33333333-3333-3333-3333-333333333333";
  const attachmentId = "44444444-4444-4444-4444-444444444444";

  const mockIncident = HealthRecordEntity.create({
    id: healthRecordId,
    farmId,
    animalId: "55555555-5555-5555-5555-555555555555",
    recordedById: userId,
    eventType: HealthEventType.ILLNESS,
    symptoms: "Deep lesion",
  });

  const mockAttachment = HealthRecordAttachmentEntity.create({
    id: attachmentId,
    farmId,
    healthRecordId,
    uploadedById: userId,
    fileName: "lesion.jpg",
    fileSizeBytes: 1024 * 500,
    mimeType: "image/jpeg",
    s3Key: `farms/${farmId}/health-records/${healthRecordId}/attachments/${attachmentId}-lesion.jpg`,
    caption: "Lesion close-up",
  });

  beforeEach(() => {
    healthRecordRepo = {
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      findUnresolvedCriticalCases: jest.fn(),
      delete: jest.fn(),
    };

    healthAttachmentRepo = {
      create: jest.fn(),
      update: jest.fn(),
      findById: jest.fn(),
      findByIncidentId: jest.fn(),
      delete: jest.fn(),
    };

    s3StorageService = {
      getPresignedPutUrl: jest.fn(),
      getPresignedGetUrl: jest.fn(),
      deleteObject: jest.fn(),
      createMultipartUpload: jest.fn(),
      getPresignedPartUploadUrl: jest.fn(),
      completeMultipartUpload: jest.fn(),
      abortMultipartUpload: jest.fn(),
      downloadFile: jest.fn(),
      uploadFileFromDisk: jest.fn(),
    };

    auditLogRepo = {
      record: jest.fn(),
      findByEntity: jest.fn(),
      findByTraceId: jest.fn(),
      query: jest.fn(),
    };

    transactionManager = {
      run: jest.fn().mockImplementation(async (callback) => callback({})),
    };

    envService = {
      s3BucketMedia: "test-media-bucket",
    } as unknown as jest.Mocked<EnvService>;

    service = new HealthAttachmentService(
      healthRecordRepo,
      healthAttachmentRepo,
      s3StorageService,
      auditLogRepo,
      transactionManager,
      envService
    );
  });

  describe("generateUploadPresignedUrl", () => {
    it("should generate a presigned PUT URL and reserve attachment record", async () => {
      healthRecordRepo.findById.mockResolvedValue(mockIncident);
      s3StorageService.getPresignedPutUrl.mockResolvedValue(
        "https://s3.example.com/presigned-put"
      );
      healthAttachmentRepo.create.mockImplementation(async (e) => e);

      const result = await service.generateUploadPresignedUrl(
        farmId,
        healthRecordId,
        userId,
        {
          fileName: "Wound Photo! (1).JPG",
          mimeType: "image/jpeg",
          fileSizeBytes: 1024 * 200,
          caption: "Wound on lower abdomen",
        }
      );

      expect(healthRecordRepo.findById).toHaveBeenCalledWith(
        healthRecordId,
        farmId
      );
      expect(s3StorageService.getPresignedPutUrl).toHaveBeenCalledWith(
        "test-media-bucket",
        expect.stringMatching(
          new RegExp(`farms/${farmId}/health-records/${healthRecordId}/attachments/.*-wound-photo-1.jpg`)
        ),
        "image/jpeg",
        900
      );
      expect(healthAttachmentRepo.create).toHaveBeenCalled();
      expect(result.uploadUrl).toBe("https://s3.example.com/presigned-put");
      expect(result.expiresInSeconds).toBe(900);
      expect(result.attachmentId).toBeDefined();
    });

    it("should throw EntityNotFoundException if clinical health incident not found", async () => {
      healthRecordRepo.findById.mockResolvedValue(null);

      await expect(
        service.generateUploadPresignedUrl(farmId, healthRecordId, userId, {
          fileName: "photo.jpg",
          mimeType: "image/jpeg",
          fileSizeBytes: 1024,
        })
      ).rejects.toThrow(EntityNotFoundException);

      expect(s3StorageService.getPresignedPutUrl).not.toHaveBeenCalled();
    });
  });

  describe("confirmUpload", () => {
    it("should confirm the attachment and return DTO with viewUrl", async () => {
      healthRecordRepo.findById.mockResolvedValue(mockIncident);
      healthAttachmentRepo.findById.mockResolvedValue(mockAttachment);
      healthAttachmentRepo.update.mockImplementation(async (e) => e);
      s3StorageService.getPresignedGetUrl.mockResolvedValue(
        "https://s3.example.com/presigned-get"
      );

      const result = await service.confirmUpload(
        farmId,
        healthRecordId,
        attachmentId,
        { caption: "Verified clean wound" }
      );

      expect(healthAttachmentRepo.update).toHaveBeenCalled();
      expect(s3StorageService.getPresignedGetUrl).toHaveBeenCalledWith(
        "test-media-bucket",
        mockAttachment.s3Key,
        3600
      );
      expect(result.status).toBe(HealthAttachmentStatus.CONFIRMED);
      expect(result.caption).toBe("Verified clean wound");
      expect(result.viewUrl).toBe("https://s3.example.com/presigned-get");
    });

    it("should throw EntityNotFoundException if attachment belongs to different incident", async () => {
      healthRecordRepo.findById.mockResolvedValue(mockIncident);
      const foreignAttachment = HealthRecordAttachmentEntity.create({
        id: attachmentId,
        farmId,
        healthRecordId: "99999999-9999-9999-9999-999999999999",
        uploadedById: userId,
        fileName: "other.jpg",
        fileSizeBytes: 1000,
        mimeType: "image/jpeg",
        s3Key: "other-key",
      });
      healthAttachmentRepo.findById.mockResolvedValue(foreignAttachment);

      await expect(
        service.confirmUpload(farmId, healthRecordId, attachmentId)
      ).rejects.toThrow(EntityNotFoundException);
    });
  });

  describe("listAttachments", () => {
    it("should list confirmed attachments with fresh view URLs", async () => {
      healthRecordRepo.findById.mockResolvedValue(mockIncident);
      const confirmedAttachment = HealthRecordAttachmentEntity.reconstitute({
        id: attachmentId,
        farmId,
        healthRecordId,
        uploadedById: userId,
        fileName: "lesion.jpg",
        fileSizeBytes: 1024,
        mimeType: "image/jpeg",
        s3Key: "key-1",
        status: HealthAttachmentStatus.CONFIRMED,
        caption: "Confirmed",
        confirmedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      healthAttachmentRepo.findByIncidentId.mockResolvedValue([
        confirmedAttachment,
      ]);
      s3StorageService.getPresignedGetUrl.mockResolvedValue(
        "https://s3.example.com/view-1"
      );

      const list = await service.listAttachments(farmId, healthRecordId);

      expect(list).toHaveLength(1);
      expect(list[0]?.id).toBe(attachmentId);
      expect(list[0]?.viewUrl).toBe("https://s3.example.com/view-1");
    });
  });

  describe("getAttachmentViewUrl", () => {
    it("should return attachment with view URL", async () => {
      healthRecordRepo.findById.mockResolvedValue(mockIncident);
      healthAttachmentRepo.findById.mockResolvedValue(mockAttachment);
      s3StorageService.getPresignedGetUrl.mockResolvedValue(
        "https://s3.example.com/single-view"
      );

      const result = await service.getAttachmentViewUrl(
        farmId,
        healthRecordId,
        attachmentId
      );

      expect(result.id).toBe(attachmentId);
      expect(result.viewUrl).toBe("https://s3.example.com/single-view");
    });
  });

  describe("deleteAttachment", () => {
    it("should delete S3 object and DB record with audit log", async () => {
      healthRecordRepo.findById.mockResolvedValue(mockIncident);
      healthAttachmentRepo.findById.mockResolvedValue(mockAttachment);
      s3StorageService.deleteObject.mockResolvedValue();
      healthAttachmentRepo.delete.mockResolvedValue();

      await service.deleteAttachment(
        farmId,
        healthRecordId,
        attachmentId,
        userId,
        "trace-123"
      );

      expect(s3StorageService.deleteObject).toHaveBeenCalledWith(
        "test-media-bucket",
        mockAttachment.s3Key
      );
      expect(healthAttachmentRepo.delete).toHaveBeenCalledWith(
        attachmentId,
        farmId,
        expect.anything()
      );
      expect(auditLogRepo.record).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          action: "HEALTH_RECORD_ATTACHMENT_DELETED",
          entityType: "HealthRecordAttachment",
          entityId: attachmentId,
        }),
        expect.anything()
      );
    });

    it("should continue DB deletion even if S3 delete throws an error", async () => {
      healthRecordRepo.findById.mockResolvedValue(mockIncident);
      healthAttachmentRepo.findById.mockResolvedValue(mockAttachment);
      s3StorageService.deleteObject.mockRejectedValue(
        new Error("S3 connection timeout")
      );
      healthAttachmentRepo.delete.mockResolvedValue();

      await service.deleteAttachment(
        farmId,
        healthRecordId,
        attachmentId,
        userId
      );

      expect(healthAttachmentRepo.delete).toHaveBeenCalledWith(
        attachmentId,
        farmId,
        expect.anything()
      );
    });
  });
});
