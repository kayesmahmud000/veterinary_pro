import { Test, TestingModule } from "@nestjs/testing";
import { Reflector } from "@nestjs/core";
import {
  AnimalSpecies,
  JwtPayload,
  PreventativeScheduleStatus,
  ReminderChannel,
  ReminderMilestone,
  ReminderStatus,
  UserRole,
  UserStatus,
  VaccineRecordType,
} from "@vetralink/shared-types";
import { TOKEN_SERVICE } from "../auth/services/token.service.interface";
import { FARM_MEMBER_REPOSITORY } from "../farms/repositories/farm-member.repository.interface";
import { VaccineScheduleController } from "./vaccine-schedule.controller";
import {
  IVaccineScheduleService,
  VACCINE_SCHEDULE_SERVICE,
} from "./services/vaccine-schedule.service.interface";
import {
  IVaccineNotificationService,
  VACCINE_NOTIFICATION_SERVICE,
} from "./services/vaccine-notification.service.interface";
import { CreateVaccineRecordDto } from "./dto/create-vaccine-record.dto";
import { UpdateVaccineRecordDto } from "./dto/update-vaccine-record.dto";
import { VaccineRecordQueryDto } from "./dto/vaccine-record-query.dto";
import { VaccineScheduleQueryDto } from "./dto/vaccine-schedule-query.dto";
import { TriggerReminderScanDto } from "./dto/trigger-reminder-scan.dto";
import { VaccineReminderLogQueryDto } from "./dto/vaccine-reminder-log-query.dto";

describe("VaccineScheduleController", () => {
  let controller: VaccineScheduleController;
  let service: jest.Mocked<IVaccineScheduleService>;
  let notificationService: jest.Mocked<IVaccineNotificationService>;

  const farmId = "11111111-1111-1111-1111-111111111111";
  const recordId = "22222222-2222-2222-2222-222222222222";
  const animalId = "33333333-3333-3333-3333-333333333333";

  const mockUser: JwtPayload = {
    sub: "44444444-4444-4444-4444-444444444444",
    email: "vet@farm.com",
    role: UserRole.VET,
    status: UserStatus.ACTIVE,
  };

  const mockRecordResponse = {
    id: recordId,
    farmId,
    animalId,
    administeredById: mockUser.sub,
    recordType: VaccineRecordType.VACCINATION,
    vaccineName: "Foot and Mouth Disease (FMD) Vaccine",
    batchNumber: "BATCH-2026-01",
    doseAmount: 2.0,
    doseUnit: "ml",
    cost: 15.0,
    notes: "Routine vaccination",
    administeredAt: "2026-09-01T08:00:00.000Z",
    nextDueDate: "2027-03-01",
    scheduleStatus: PreventativeScheduleStatus.UPCOMING,
    isOverdue: false,
    daysUntilDue: 169,
    syncVersion: 1,
    createdAt: "2026-09-01T08:00:00.000Z",
    updatedAt: "2026-09-01T08:00:00.000Z",
  };

  beforeEach(async () => {
    service = {
      recordAdministration: jest.fn(),
      getRecordById: jest.fn(),
      listRecords: jest.fn(),
      getScheduleSummary: jest.fn(),
      getSpeciesProtocols: jest.fn(),
      updateRecord: jest.fn(),
      deleteRecord: jest.fn(),
    };

    notificationService = {
      processFarmDueReminders: jest.fn(),
      dispatchReminderForRecord: jest.fn(),
      listReminderLogs: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [VaccineScheduleController],
      providers: [
        {
          provide: VACCINE_SCHEDULE_SERVICE,
          useValue: service,
        },
        {
          provide: VACCINE_NOTIFICATION_SERVICE,
          useValue: notificationService,
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

    controller = module.get<VaccineScheduleController>(VaccineScheduleController);
  });

  describe("recordAdministration", () => {
    it("should delegate to service.recordAdministration", async () => {
      const dto: CreateVaccineRecordDto = {
        animalId,
        recordType: VaccineRecordType.VACCINATION,
        vaccineName: "Foot and Mouth Disease (FMD) Vaccine",
        doseAmount: 2.0,
        doseUnit: "ml",
        administeredAt: "2026-09-01T08:00:00.000Z",
      };
      service.recordAdministration.mockResolvedValueOnce(mockRecordResponse);

      const result = await controller.recordAdministration(
        farmId,
        mockUser,
        dto,
        "trace-123"
      );

      expect(service.recordAdministration).toHaveBeenCalledWith(
        farmId,
        mockUser.sub,
        dto,
        "trace-123"
      );
      expect(result).toEqual(mockRecordResponse);
    });
  });

  describe("listRecords", () => {
    it("should delegate to service.listRecords", async () => {
      const query: VaccineRecordQueryDto = {
        recordType: VaccineRecordType.VACCINATION,
        page: 1,
        limit: 10,
      };
      const paginatedResult = {
        items: [mockRecordResponse],
        meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
      };
      service.listRecords.mockResolvedValueOnce(paginatedResult);

      const result = await controller.listRecords(farmId, query);

      expect(service.listRecords).toHaveBeenCalledWith(farmId, query);
      expect(result).toEqual(paginatedResult);
    });
  });

  describe("getScheduleSummary", () => {
    it("should delegate to service.getScheduleSummary", async () => {
      const query: VaccineScheduleQueryDto = {
        daysAhead: 30,
      };
      const summaryResult = {
        totalRecords: 1,
        totalVaccinations: 1,
        totalDewormings: 0,
        dueNext7Days: 0,
        dueNext30Days: 0,
        overdueCount: 0,
        upcomingEvents: [mockRecordResponse],
      };
      service.getScheduleSummary.mockResolvedValueOnce(summaryResult);

      const result = await controller.getScheduleSummary(farmId, query);

      expect(service.getScheduleSummary).toHaveBeenCalledWith(farmId, query);
      expect(result).toEqual(summaryResult);
    });
  });

  describe("getSpeciesProtocols", () => {
    it("should delegate to service.getSpeciesProtocols", () => {
      const protocolsResult = [
        {
          species: AnimalSpecies.COW,
          speciesDisplayName: "Cattle / Cow",
          description: "Standard cattle preventative vaccination protocol",
          steps: [],
        },
      ];
      service.getSpeciesProtocols.mockReturnValueOnce(protocolsResult);

      const result = controller.getSpeciesProtocols(AnimalSpecies.COW);

      expect(service.getSpeciesProtocols).toHaveBeenCalledWith(AnimalSpecies.COW);
      expect(result).toEqual(protocolsResult);
    });
  });

  describe("triggerReminderScan", () => {
    it("should delegate to notificationService.processFarmDueReminders", async () => {
      const dto: TriggerReminderScanDto = {
        asOfDate: "2026-09-13",
        daysAhead: 7,
        dryRun: false,
      };
      const scanResult = {
        farmId,
        scanDate: "2026-09-13",
        totalScanned: 2,
        dueWithinHorizon: 1,
        remindersDispatched: 2,
        remindersSkipped: 0,
        remindersFailed: 0,
        details: [],
      };
      notificationService.processFarmDueReminders.mockResolvedValueOnce(
        scanResult
      );

      const result = await controller.triggerReminderScan(
        farmId,
        dto,
        "trace-scan"
      );

      expect(notificationService.processFarmDueReminders).toHaveBeenCalledWith(
        farmId,
        expect.any(Date),
        7,
        false,
        "trace-scan"
      );
      expect(result).toEqual(scanResult);
    });
  });

  describe("listReminderLogs", () => {
    it("should delegate to notificationService.listReminderLogs", async () => {
      const query: VaccineReminderLogQueryDto = {
        channel: ReminderChannel.SMS,
        page: 1,
        limit: 10,
      };
      const logsResult = {
        items: [],
        meta: { page: 1, pageSize: 10, total: 0, totalPages: 1 },
      };
      notificationService.listReminderLogs.mockResolvedValueOnce(logsResult);

      const result = await controller.listReminderLogs(farmId, query);

      expect(notificationService.listReminderLogs).toHaveBeenCalledWith(
        farmId,
        query
      );
      expect(result).toEqual(logsResult);
    });
  });

  describe("getRecordById", () => {
    it("should delegate to service.getRecordById", async () => {
      service.getRecordById.mockResolvedValueOnce(mockRecordResponse);

      const result = await controller.getRecordById(farmId, recordId, "2026-09-02");

      expect(service.getRecordById).toHaveBeenCalledWith(
        recordId,
        farmId,
        "2026-09-02"
      );
      expect(result).toEqual(mockRecordResponse);
    });
  });

  describe("updateRecord", () => {
    it("should delegate to service.updateRecord", async () => {
      const dto: UpdateVaccineRecordDto = {
        notes: "Updated notes",
        syncVersion: 1,
      };
      const updatedResponse = { ...mockRecordResponse, notes: "Updated notes" };
      service.updateRecord.mockResolvedValueOnce(updatedResponse);

      const result = await controller.updateRecord(
        farmId,
        mockUser,
        recordId,
        dto,
        "trace-456"
      );

      expect(service.updateRecord).toHaveBeenCalledWith(
        recordId,
        farmId,
        mockUser.sub,
        dto,
        "trace-456"
      );
      expect(result).toEqual(updatedResponse);
    });
  });

  describe("deleteRecord", () => {
    it("should delegate to service.deleteRecord", async () => {
      service.deleteRecord.mockResolvedValueOnce();

      await controller.deleteRecord(farmId, mockUser, recordId, "trace-789");

      expect(service.deleteRecord).toHaveBeenCalledWith(
        recordId,
        farmId,
        mockUser.sub,
        "trace-789"
      );
    });
  });
});
