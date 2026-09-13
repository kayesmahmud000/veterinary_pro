import { HealthAttachmentStatus } from "@vetralink/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { HealthRecordAttachmentEntity } from "../entities/health-record-attachment.entity";
import { HealthRecordAttachmentRepository } from "./health-record-attachment.repository";

describe("HealthRecordAttachmentRepository", () => {
  let repository: HealthRecordAttachmentRepository;
  let prisma: jest.Mocked<PrismaService>;

  const farmId = "11111111-1111-1111-1111-111111111111";
  const incidentId = "22222222-2222-2222-2222-222222222222";
  const userId = "33333333-3333-3333-3333-333333333333";
  const attachmentId = "44444444-4444-4444-4444-444444444444";

  const mockDbRow = {
    id: attachmentId,
    farmId,
    healthRecordId: incidentId,
    uploadedById: userId,
    fileName: "lesion-photo.jpg",
    fileSizeBytes: 1024 * 500,
    mimeType: "image/jpeg",
    s3Key: `farms/${farmId}/health-records/${incidentId}/attachments/${attachmentId}-lesion-photo.jpg`,
    status: "PENDING_UPLOAD" as const,
    caption: "Lesion on skin",
    confirmedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    prisma = {
      healthRecordAttachment: {
        create: jest.fn(),
        update: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        deleteMany: jest.fn(),
      },
    } as unknown as jest.Mocked<PrismaService>;

    repository = new HealthRecordAttachmentRepository(prisma);
  });

  describe("create", () => {
    it("should persist and return a reconstituted HealthRecordAttachmentEntity", async () => {
      (prisma.healthRecordAttachment.create as jest.Mock).mockResolvedValue(
        mockDbRow
      );

      const entity = HealthRecordAttachmentEntity.create({
        id: attachmentId,
        farmId,
        healthRecordId: incidentId,
        uploadedById: userId,
        fileName: "lesion-photo.jpg",
        fileSizeBytes: 1024 * 500,
        mimeType: "image/jpeg",
        s3Key: mockDbRow.s3Key,
        caption: "Lesion on skin",
      });

      const result = await repository.create(entity);

      expect(prisma.healthRecordAttachment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: attachmentId,
          farmId,
          healthRecordId: incidentId,
          uploadedById: userId,
          fileName: "lesion-photo.jpg",
          mimeType: "image/jpeg",
          s3Key: mockDbRow.s3Key,
          status: "PENDING_UPLOAD",
        }),
      });

      expect(result.id).toBe(attachmentId);
      expect(result.fileName).toBe("lesion-photo.jpg");
      expect(result.status).toBe(HealthAttachmentStatus.PENDING_UPLOAD);
    });
  });

  describe("update", () => {
    it("should update status and caption on database record", async () => {
      const confirmedRow = {
        ...mockDbRow,
        status: "CONFIRMED" as const,
        confirmedAt: new Date(),
        caption: "Confirmed lesion",
      };

      (prisma.healthRecordAttachment.update as jest.Mock).mockResolvedValue(
        confirmedRow
      );

      const entity = HealthRecordAttachmentEntity.reconstitute({
        id: attachmentId,
        farmId,
        healthRecordId: incidentId,
        uploadedById: userId,
        fileName: "lesion-photo.jpg",
        fileSizeBytes: 1024 * 500,
        mimeType: "image/jpeg",
        s3Key: mockDbRow.s3Key,
        status: HealthAttachmentStatus.CONFIRMED,
        caption: "Confirmed lesion",
        confirmedAt: confirmedRow.confirmedAt,
        createdAt: mockDbRow.createdAt,
        updatedAt: confirmedRow.updatedAt,
      });

      const result = await repository.update(entity);

      expect(prisma.healthRecordAttachment.update).toHaveBeenCalledWith({
        where: { id: attachmentId },
        data: {
          status: "CONFIRMED",
          caption: "Confirmed lesion",
          confirmedAt: confirmedRow.confirmedAt,
          updatedAt: expect.any(Date),
        },
      });

      expect(result.status).toBe(HealthAttachmentStatus.CONFIRMED);
      expect(result.caption).toBe("Confirmed lesion");
    });
  });

  describe("findById", () => {
    it("should find an attachment scoped by id and farmId", async () => {
      (prisma.healthRecordAttachment.findFirst as jest.Mock).mockResolvedValue(
        mockDbRow
      );

      const result = await repository.findById(attachmentId, farmId);

      expect(prisma.healthRecordAttachment.findFirst).toHaveBeenCalledWith({
        where: {
          id: attachmentId,
          farmId,
        },
      });

      expect(result).not.toBeNull();
      expect(result?.id).toBe(attachmentId);
    });

    it("should return null if attachment does not exist or farmId mismatch", async () => {
      (prisma.healthRecordAttachment.findFirst as jest.Mock).mockResolvedValue(
        null
      );

      const result = await repository.findById(attachmentId, farmId);

      expect(result).toBeNull();
    });
  });

  describe("findByIncidentId", () => {
    it("should return attachments for a specific health incident and farm", async () => {
      (prisma.healthRecordAttachment.findMany as jest.Mock).mockResolvedValue([
        mockDbRow,
      ]);

      const result = await repository.findByIncidentId(incidentId, farmId);

      expect(prisma.healthRecordAttachment.findMany).toHaveBeenCalledWith({
        where: {
          healthRecordId: incidentId,
          farmId,
        },
        orderBy: {
          createdAt: "asc",
        },
      });

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe(attachmentId);
    });

    it("should filter by status if provided", async () => {
      (prisma.healthRecordAttachment.findMany as jest.Mock).mockResolvedValue([
        { ...mockDbRow, status: "CONFIRMED" },
      ]);

      const result = await repository.findByIncidentId(
        incidentId,
        farmId,
        HealthAttachmentStatus.CONFIRMED
      );

      expect(prisma.healthRecordAttachment.findMany).toHaveBeenCalledWith({
        where: {
          healthRecordId: incidentId,
          farmId,
          status: "CONFIRMED",
        },
        orderBy: {
          createdAt: "asc",
        },
      });

      expect(result).toHaveLength(1);
      expect(result[0]?.status).toBe(HealthAttachmentStatus.CONFIRMED);
    });
  });

  describe("delete", () => {
    it("should delete attachment by id and farmId", async () => {
      (prisma.healthRecordAttachment.deleteMany as jest.Mock).mockResolvedValue({
        count: 1,
      });

      await repository.delete(attachmentId, farmId);

      expect(prisma.healthRecordAttachment.deleteMany).toHaveBeenCalledWith({
        where: {
          id: attachmentId,
          farmId,
        },
      });
    });
  });
});
