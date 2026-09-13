import { HealthAttachmentStatus } from "@vetralink/shared-types";
import {
  HealthRecordAttachmentEntity,
  MAX_HEALTH_ATTACHMENT_SIZE_BYTES,
} from "./health-record-attachment.entity";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";

describe("HealthRecordAttachmentEntity", () => {
  const validProps = {
    farmId: "11111111-1111-1111-1111-111111111111",
    healthRecordId: "22222222-2222-2222-2222-222222222222",
    uploadedById: "33333333-3333-3333-3333-333333333333",
    fileName: "lesion-left-flank.jpg",
    fileSizeBytes: 2 * 1024 * 1024,
    mimeType: "image/jpeg",
    s3Key: "farms/111/health-records/222/attachments/attachment-1.jpg",
    caption: "Superficial laceration on left flank",
  };

  describe("create", () => {
    it("should successfully create a valid pending attachment entity", () => {
      const entity = HealthRecordAttachmentEntity.create(validProps);

      expect(entity.id).toBeDefined();
      expect(entity.farmId).toBe(validProps.farmId);
      expect(entity.healthRecordId).toBe(validProps.healthRecordId);
      expect(entity.uploadedById).toBe(validProps.uploadedById);
      expect(entity.fileName).toBe(validProps.fileName);
      expect(entity.fileSizeBytes).toBe(validProps.fileSizeBytes);
      expect(entity.mimeType).toBe("image/jpeg");
      expect(entity.s3Key).toBe(validProps.s3Key);
      expect(entity.status).toBe(HealthAttachmentStatus.PENDING_UPLOAD);
      expect(entity.isConfirmed).toBe(false);
      expect(entity.caption).toBe(validProps.caption);
      expect(entity.confirmedAt).toBeNull();
      expect(entity.createdAt).toBeInstanceOf(Date);
      expect(entity.updatedAt).toBeInstanceOf(Date);
    });

    it("should accept valid PNG and WebP MIME types", () => {
      const pngEntity = HealthRecordAttachmentEntity.create({
        ...validProps,
        fileName: "symptom.png",
        mimeType: "IMAGE/PNG",
      });
      expect(pngEntity.mimeType).toBe("image/png");

      const webpEntity = HealthRecordAttachmentEntity.create({
        ...validProps,
        fileName: "symptom.webp",
        mimeType: "image/webp",
      });
      expect(webpEntity.mimeType).toBe("image/webp");
    });

    it("should throw ValidationDomainException if farmId is empty", () => {
      expect(() =>
        HealthRecordAttachmentEntity.create({
          ...validProps,
          farmId: "  ",
        })
      ).toThrow(ValidationDomainException);
    });

    it("should throw ValidationDomainException if healthRecordId is empty", () => {
      expect(() =>
        HealthRecordAttachmentEntity.create({
          ...validProps,
          healthRecordId: "",
        })
      ).toThrow(ValidationDomainException);
    });

    it("should throw ValidationDomainException if uploadedById is empty", () => {
      expect(() =>
        HealthRecordAttachmentEntity.create({
          ...validProps,
          uploadedById: "",
        })
      ).toThrow(ValidationDomainException);
    });

    it("should throw ValidationDomainException if fileName is empty or too long", () => {
      expect(() =>
        HealthRecordAttachmentEntity.create({
          ...validProps,
          fileName: "",
        })
      ).toThrow(ValidationDomainException);

      expect(() =>
        HealthRecordAttachmentEntity.create({
          ...validProps,
          fileName: "a".repeat(256),
        })
      ).toThrow(ValidationDomainException);
    });

    it("should throw ValidationDomainException if fileSizeBytes <= 0 or exceeds max limit", () => {
      expect(() =>
        HealthRecordAttachmentEntity.create({
          ...validProps,
          fileSizeBytes: 0,
        })
      ).toThrow(ValidationDomainException);

      expect(() =>
        HealthRecordAttachmentEntity.create({
          ...validProps,
          fileSizeBytes: MAX_HEALTH_ATTACHMENT_SIZE_BYTES + 1,
        })
      ).toThrow(ValidationDomainException);
    });

    it("should throw ValidationDomainException if MIME type is invalid (e.g. application/pdf, image/gif)", () => {
      expect(() =>
        HealthRecordAttachmentEntity.create({
          ...validProps,
          mimeType: "application/pdf",
        })
      ).toThrow(ValidationDomainException);

      expect(() =>
        HealthRecordAttachmentEntity.create({
          ...validProps,
          mimeType: "image/gif",
        })
      ).toThrow(ValidationDomainException);
    });

    it("should throw ValidationDomainException if s3Key is empty", () => {
      expect(() =>
        HealthRecordAttachmentEntity.create({
          ...validProps,
          s3Key: "",
        })
      ).toThrow(ValidationDomainException);
    });
  });

  describe("confirm and updateCaption", () => {
    it("should transition status to CONFIRMED and record confirmedAt", () => {
      const entity = HealthRecordAttachmentEntity.create(validProps);
      expect(entity.isConfirmed).toBe(false);

      entity.confirm("Updated caption on confirmation");
      expect(entity.status).toBe(HealthAttachmentStatus.CONFIRMED);
      expect(entity.isConfirmed).toBe(true);
      expect(entity.caption).toBe("Updated caption on confirmation");
      expect(entity.confirmedAt).toBeInstanceOf(Date);
    });

    it("should allow updating caption", () => {
      const entity = HealthRecordAttachmentEntity.create(validProps);
      entity.updateCaption("Newly revised caption");
      expect(entity.caption).toBe("Newly revised caption");

      entity.updateCaption(null);
      expect(entity.caption).toBeNull();
    });
  });

  describe("reconstitute and toResponseDto", () => {
    it("should reconstitute and export complete DTO with viewUrl", () => {
      const now = new Date();
      const entity = HealthRecordAttachmentEntity.reconstitute({
        id: "att-123",
        farmId: validProps.farmId,
        healthRecordId: validProps.healthRecordId,
        uploadedById: validProps.uploadedById,
        fileName: validProps.fileName,
        fileSizeBytes: validProps.fileSizeBytes,
        mimeType: validProps.mimeType,
        s3Key: validProps.s3Key,
        status: HealthAttachmentStatus.CONFIRMED,
        caption: validProps.caption,
        viewUrl: "https://s3.example.com/view-url",
        confirmedAt: now,
        createdAt: now,
        updatedAt: now,
      });

      expect(entity.isConfirmed).toBe(true);
      const dto = entity.toResponseDto("https://s3.example.com/custom-url");
      expect(dto.id).toBe("att-123");
      expect(dto.viewUrl).toBe("https://s3.example.com/custom-url");
      expect(dto.status).toBe(HealthAttachmentStatus.CONFIRMED);
      expect(dto.confirmedAt).toBe(now.toISOString());
    });
  });
});
