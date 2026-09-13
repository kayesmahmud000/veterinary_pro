import { Test, TestingModule } from "@nestjs/testing";
import { Reflector } from "@nestjs/core";
import {
  HealthAttachmentStatus,
  HealthEventType,
  JwtPayload,
  SeverityLevel,
  UserRole,
  UserStatus,
} from "@vetralink/shared-types";
import { TOKEN_SERVICE } from "../auth/services/token.service.interface";
import { FARM_MEMBER_REPOSITORY } from "../farms/repositories/farm-member.repository.interface";
import { ClinicalHealthController } from "./clinical-health.controller";
import {
  CLINICAL_HEALTH_SERVICE,
  IClinicalHealthService,
} from "./services/clinical-health.service.interface";
import {
  HEALTH_ESCALATION_SERVICE,
  IHealthEscalationService,
} from "./services/health-escalation.service.interface";
import {
  HEALTH_ATTACHMENT_SERVICE,
  IHealthAttachmentService,
} from "./services/health-attachment.service.interface";
import { CreateHealthIncidentDto } from "./dto/create-health-incident.dto";
import { UpdateHealthIncidentDto } from "./dto/update-health-incident.dto";
import { ResolveHealthIncidentDto } from "./dto/resolve-health-incident.dto";
import { HealthIncidentQueryDto } from "./dto/health-incident-query.dto";
import { TriggerEscalationScanDto } from "./dto/trigger-escalation-scan.dto";
import { HealthEscalationLogQueryDto } from "./dto/health-escalation-log-query.dto";

describe("ClinicalHealthController", () => {
  let controller: ClinicalHealthController;
  let service: jest.Mocked<IClinicalHealthService>;
  let escalationService: jest.Mocked<IHealthEscalationService>;
  let attachmentService: jest.Mocked<IHealthAttachmentService>;

  const farmId = "11111111-1111-1111-1111-111111111111";
  const incidentId = "22222222-2222-2222-2222-222222222222";
  const animalId = "33333333-3333-3333-3333-333333333333";

  const mockUser: JwtPayload = {
    sub: "44444444-4444-4444-4444-444444444444",
    email: "vet@farm.com",
    role: UserRole.VET,
    status: UserStatus.ACTIVE,
  };

  const mockIncidentResponse = {
    id: incidentId,
    farmId,
    animalId,
    recordedById: mockUser.sub,
    attendingVetId: null,
    eventType: HealthEventType.ILLNESS,
    severity: SeverityLevel.MEDIUM,
    symptoms: "Lethargy and loss of appetite",
    diagnosis: "Ruminal Acidosis",
    treatment: "Administered sodium bicarbonate buffer drench",
    cost: 50.0,
    resolvedAt: null,
    isResolved: false,
    syncVersion: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(async () => {
    service = {
      createIncident: jest.fn(),
      getIncidentById: jest.fn(),
      listIncidents: jest.fn(),
      updateIncident: jest.fn(),
      resolveIncident: jest.fn(),
      deleteIncident: jest.fn(),
    };

    escalationService = {
      processFarmEscalations: jest.fn(),
      listEscalationLogs: jest.fn(),
      listActiveEscalations: jest.fn(),
    };

    attachmentService = {
      generateUploadPresignedUrl: jest.fn(),
      confirmUpload: jest.fn(),
      listAttachments: jest.fn(),
      getAttachmentViewUrl: jest.fn(),
      deleteAttachment: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClinicalHealthController],
      providers: [
        {
          provide: CLINICAL_HEALTH_SERVICE,
          useValue: service,
        },
        {
          provide: HEALTH_ESCALATION_SERVICE,
          useValue: escalationService,
        },
        {
          provide: HEALTH_ATTACHMENT_SERVICE,
          useValue: attachmentService,
        },
        {
          provide: TOKEN_SERVICE,
          useValue: { verifyAccessToken: jest.fn() },
        },
        {
          provide: FARM_MEMBER_REPOSITORY,
          useValue: { findMembership: jest.fn() },
        },
        Reflector,
      ],
    }).compile();

    controller = module.get<ClinicalHealthController>(ClinicalHealthController);
  });

  describe("createIncident", () => {
    it("should delegate to service.createIncident", async () => {
      const dto: CreateHealthIncidentDto = {
        animalId,
        eventType: HealthEventType.ILLNESS,
        severity: SeverityLevel.MEDIUM,
        symptoms: "Lethargy and loss of appetite",
        cost: 50.0,
      };
      service.createIncident.mockResolvedValueOnce(mockIncidentResponse);

      const result = await controller.createIncident(
        farmId,
        mockUser,
        dto,
        "trace-123"
      );

      expect(service.createIncident).toHaveBeenCalledWith(
        farmId,
        mockUser.sub,
        dto,
        "trace-123"
      );
      expect(result).toEqual(mockIncidentResponse);
    });
  });

  describe("listIncidents", () => {
    it("should delegate to service.listIncidents", async () => {
      const query: HealthIncidentQueryDto = { page: 1, limit: 20 };
      const paginatedResponse = {
        items: [mockIncidentResponse],
        meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      };
      service.listIncidents.mockResolvedValueOnce(paginatedResponse);

      const result = await controller.listIncidents(farmId, query);

      expect(service.listIncidents).toHaveBeenCalledWith(farmId, query);
      expect(result).toEqual(paginatedResponse);
    });
  });

  describe("getIncidentById", () => {
    it("should delegate to service.getIncidentById", async () => {
      service.getIncidentById.mockResolvedValueOnce(mockIncidentResponse);

      const result = await controller.getIncidentById(farmId, incidentId);

      expect(service.getIncidentById).toHaveBeenCalledWith(incidentId, farmId);
      expect(result).toEqual(mockIncidentResponse);
    });
  });

  describe("updateIncident", () => {
    it("should delegate to service.updateIncident", async () => {
      const dto: UpdateHealthIncidentDto = {
        diagnosis: "Confirmed subacute acidosis",
        cost: 65.0,
      };
      const updatedResponse = {
        ...mockIncidentResponse,
        diagnosis: "Confirmed subacute acidosis",
        cost: 65.0,
        syncVersion: 2,
      };
      service.updateIncident.mockResolvedValueOnce(updatedResponse);

      const result = await controller.updateIncident(
        farmId,
        mockUser,
        incidentId,
        dto,
        "trace-456"
      );

      expect(service.updateIncident).toHaveBeenCalledWith(
        incidentId,
        farmId,
        mockUser.sub,
        dto,
        "trace-456"
      );
      expect(result).toEqual(updatedResponse);
    });
  });

  describe("resolveIncident", () => {
    it("should delegate to service.resolveIncident", async () => {
      const dto: ResolveHealthIncidentDto = {
        treatment: "Fully recovered and back on normal diet",
        cost: 65.0,
      };
      const resolvedResponse = {
        ...mockIncidentResponse,
        treatment: "Fully recovered and back on normal diet",
        resolvedAt: new Date().toISOString(),
        isResolved: true,
        cost: 65.0,
        syncVersion: 2,
      };
      service.resolveIncident.mockResolvedValueOnce(resolvedResponse);

      const result = await controller.resolveIncident(
        farmId,
        mockUser,
        incidentId,
        dto,
        "trace-789"
      );

      expect(service.resolveIncident).toHaveBeenCalledWith(
        incidentId,
        farmId,
        mockUser.sub,
        dto,
        "trace-789"
      );
      expect(result).toEqual(resolvedResponse);
    });
  });

  describe("deleteIncident", () => {
    it("should delegate to service.deleteIncident", async () => {
      service.deleteIncident.mockResolvedValueOnce();

      await controller.deleteIncident(farmId, mockUser, incidentId, "trace-000");

      expect(service.deleteIncident).toHaveBeenCalledWith(
        incidentId,
        farmId,
        mockUser.sub,
        "trace-000"
      );
    });
  });

  describe("triggerEscalationScan", () => {
    it("should delegate to escalationService.processFarmEscalations", async () => {
      const dto: TriggerEscalationScanDto = {
        asOfDate: "2026-09-13",
        dryRun: false,
      };
      const mockScanResult = {
        farmId,
        scanDate: "2026-09-13",
        totalUnresolvedScanned: 2,
        totalEligibleForEscalation: 1,
        escalationsDispatched: 2,
        escalationsSkipped: 0,
        escalationsFailed: 0,
        details: [],
      };
      escalationService.processFarmEscalations.mockResolvedValueOnce(mockScanResult);

      const result = await controller.triggerEscalationScan(farmId, dto, "trace-scan");

      expect(escalationService.processFarmEscalations).toHaveBeenCalledWith(
        farmId,
        expect.any(Date),
        false,
        "trace-scan"
      );
      expect(result).toEqual(mockScanResult);
    });
  });

  describe("listEscalationLogs", () => {
    it("should delegate to escalationService.listEscalationLogs", async () => {
      const query: HealthEscalationLogQueryDto = { page: 1, limit: 10 };
      const mockLogsResult = {
        items: [],
        meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 },
      };
      escalationService.listEscalationLogs.mockResolvedValueOnce(mockLogsResult);

      const result = await controller.listEscalationLogs(farmId, query);

      expect(escalationService.listEscalationLogs).toHaveBeenCalledWith(farmId, query);
      expect(result).toEqual(mockLogsResult);
    });
  });

  describe("listActiveEscalations", () => {
    it("should delegate to escalationService.listActiveEscalations", async () => {
      escalationService.listActiveEscalations.mockResolvedValueOnce([]);

      const result = await controller.listActiveEscalations(farmId);

      expect(escalationService.listActiveEscalations).toHaveBeenCalledWith(farmId);
      expect(result).toEqual([]);
    });
  });

  describe("attachment endpoints", () => {
    const attachmentId = "55555555-5555-5555-5555-555555555555";

    it("should request presigned upload URL", async () => {
      const dto = {
        fileName: "lesion.jpg",
        mimeType: "image/jpeg",
        fileSizeBytes: 1024 * 50,
      };
      const mockPresigned = {
        attachmentId,
        uploadUrl: "https://s3.example.com/put",
        s3Key: "some-key",
        expiresInSeconds: 900,
      };
      attachmentService.generateUploadPresignedUrl.mockResolvedValueOnce(
        mockPresigned
      );

      const result = await controller.requestAttachmentUploadUrl(
        farmId,
        mockUser,
        incidentId,
        dto
      );

      expect(
        attachmentService.generateUploadPresignedUrl
      ).toHaveBeenCalledWith(farmId, incidentId, mockUser.sub, dto);
      expect(result).toEqual(mockPresigned);
    });

    it("should confirm attachment upload", async () => {
      const dto = { caption: "Confirmed wound" };
      const mockResponse = {
        id: attachmentId,
        farmId,
        healthRecordId: incidentId,
        uploadedById: mockUser.sub,
        fileName: "lesion.jpg",
        fileSizeBytes: 1024 * 50,
        mimeType: "image/jpeg",
        s3Key: "some-key",
        status: HealthAttachmentStatus.CONFIRMED,
        caption: "Confirmed wound",
        viewUrl: "https://s3.example.com/get",
        confirmedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      attachmentService.confirmUpload.mockResolvedValueOnce(mockResponse);

      const result = await controller.confirmAttachmentUpload(
        farmId,
        incidentId,
        attachmentId,
        dto
      );

      expect(attachmentService.confirmUpload).toHaveBeenCalledWith(
        farmId,
        incidentId,
        attachmentId,
        dto
      );
      expect(result).toEqual(mockResponse);
    });

    it("should list attachments for incident", async () => {
      attachmentService.listAttachments.mockResolvedValueOnce([]);

      const result = await controller.listAttachments(farmId, incidentId);

      expect(attachmentService.listAttachments).toHaveBeenCalledWith(
        farmId,
        incidentId
      );
      expect(result).toEqual([]);
    });

    it("should get attachment view URL", async () => {
      const mockResponse = {
        id: attachmentId,
        farmId,
        healthRecordId: incidentId,
        uploadedById: mockUser.sub,
        fileName: "lesion.jpg",
        fileSizeBytes: 1024 * 50,
        mimeType: "image/jpeg",
        s3Key: "some-key",
        status: HealthAttachmentStatus.CONFIRMED,
        caption: null,
        viewUrl: "https://s3.example.com/view",
        confirmedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      attachmentService.getAttachmentViewUrl.mockResolvedValueOnce(
        mockResponse
      );

      const result = await controller.getAttachmentViewUrl(
        farmId,
        incidentId,
        attachmentId
      );

      expect(attachmentService.getAttachmentViewUrl).toHaveBeenCalledWith(
        farmId,
        incidentId,
        attachmentId
      );
      expect(result).toEqual(mockResponse);
    });

    it("should delete attachment", async () => {
      attachmentService.deleteAttachment.mockResolvedValueOnce();

      await controller.deleteAttachment(
        farmId,
        mockUser,
        incidentId,
        attachmentId,
        "trace-del"
      );

      expect(attachmentService.deleteAttachment).toHaveBeenCalledWith(
        farmId,
        incidentId,
        attachmentId,
        mockUser.sub,
        "trace-del"
      );
    });
  });
});
