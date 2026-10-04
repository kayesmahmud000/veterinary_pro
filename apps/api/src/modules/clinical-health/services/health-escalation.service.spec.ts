import {
  HealthEscalationAction,
  HealthEscalationLevel,
  HealthEventType,
  ReminderChannel,
  ReminderStatus,
  SeverityLevel,
} from "@vetralink/shared-types";
import { EntityNotFoundException } from "../../../common/exceptions/domain.exception";
import { PrismaService } from "../../prisma/prisma.service";
import { HealthEscalationLogEntity } from "../entities/health-escalation-log.entity";
import { HealthRecordEntity } from "../entities/health-record.entity";
import { IHealthRecordRepository } from "../repositories/health-record.repository.interface";
import { IHealthEscalationLogRepository } from "../repositories/health-escalation-log.repository.interface";
import {
  IPushNotificationProvider,
  ISmsNotificationProvider,
} from "../providers/notification-provider.interface";
import { HealthEscalationService } from "./health-escalation.service";

describe("HealthEscalationService", () => {
  let service: HealthEscalationService;
  let healthRecordRepo: jest.Mocked<IHealthRecordRepository>;
  let escalationLogRepo: jest.Mocked<IHealthEscalationLogRepository>;
  let smsProvider: jest.Mocked<ISmsNotificationProvider>;
  let pushProvider: jest.Mocked<IPushNotificationProvider>;
  let prisma: {
    farm: {
      findUnique: jest.Mock;
    };
  };

  const farmId = "11111111-1111-1111-1111-111111111111";
  const ownerId = "22222222-2222-2222-2222-222222222222";
  const vetId = "33333333-3333-3333-3333-333333333333";
  const animalId = "44444444-4444-4444-4444-444444444444";

  const mockFarm = {
    id: farmId,
    name: "Green Valley Farm",
    ownerId,
    owner: {
      id: ownerId,
      name: "Farmer Giles",
      phone: "+15551234567",
      email: "giles@farm.com",
    },
    members: [],
  };

  const createIncident = (
    severity: SeverityLevel,
    hoursAgo: number,
    escalationLevel = 0
  ) => {
    const createdAt = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
    const entity = HealthRecordEntity.create({
      id: crypto.randomUUID(),
      farmId,
      animalId,
      recordedById: ownerId,
      attendingVetId: vetId,
      eventType: HealthEventType.ILLNESS,
      severity,
      symptoms: "Severe respiratory distress and lethargy",
      diagnosis: "Bovine Viral Diarrhea",
      cost: 150,
      escalationLevel,
    });
    // Reconstitute with exact createdAt
    return new HealthRecordEntity({
      id: entity.id,
      farmId: entity.farmId,
      animalId: entity.animalId,
      recordedById: entity.recordedById,
      attendingVetId: entity.attendingVetId,
      eventType: entity.eventType,
      severity: entity.severity,
      symptoms: entity.symptoms,
      diagnosis: entity.diagnosis,
      treatment: entity.treatment,
      cost: entity.cost,
      resolvedAt: null,
      escalationLevel,
      lastEscalatedAt: null,
      syncVersion: 1,
      createdAt,
      updatedAt: createdAt,
      animal: {
        id: animalId,
        tagNumber: "COW-042",
        name: "Bessie",
        species: "COW",
        breed: "Holstein",
        gender: "FEMALE",
      },
      attendingVet: {
        id: vetId,
        name: "Dr. Vet",
        email: "vet@clinic.com",
        role: "VET",
      },
    });
  };

  beforeEach(() => {
    healthRecordRepo = {
      create: jest.fn(),
      update: jest.fn(),
      findById: jest.fn(),
      findMany: jest.fn(),
      findUnresolvedCriticalCases: jest.fn(),
      delete: jest.fn(),
    };

    escalationLogRepo = {
      create: jest.fn(),
      hasEscalationBeenLogged: jest.fn(),
      findById: jest.fn(),
      findMany: jest.fn(),
      findActiveEscalations: jest.fn(),
    };

    smsProvider = {
      sendSms: jest.fn().mockResolvedValue({ success: true, messageId: "sms-1" }),
    };

    pushProvider = {
      sendPush: jest.fn().mockResolvedValue({ success: true, messageId: "push-1" }),
    };

    prisma = {
      farm: {
        findUnique: jest.fn().mockResolvedValue(mockFarm),
      },
    };

    service = new HealthEscalationService(
      healthRecordRepo,
      escalationLogRepo,
      smsProvider,
      pushProvider,
      prisma as unknown as PrismaService
    );
  });

  describe("processFarmEscalations", () => {
    it("should throw EntityNotFoundException if farm does not exist", async () => {
      prisma.farm.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.processFarmEscalations("non-existent-farm")
      ).rejects.toThrow(EntityNotFoundException);
    });

    it("should escalate CRITICAL incident >= 24h to LEVEL_1_STAFF_ALERT via SMS and Push", async () => {
      const incident = createIncident(SeverityLevel.CRITICAL, 26);
      healthRecordRepo.findUnresolvedCriticalCases.mockResolvedValueOnce([incident]);
      escalationLogRepo.hasEscalationBeenLogged.mockResolvedValue(false);
      escalationLogRepo.create.mockImplementation(async (e) => e);
      healthRecordRepo.update.mockResolvedValueOnce(incident);

      const result = await service.processFarmEscalations(farmId);

      expect(result.totalUnresolvedScanned).toBe(1);
      expect(result.totalEligibleForEscalation).toBe(1);
      expect(result.escalationsDispatched).toBe(2); // SMS + PUSH
      expect(result.escalationsSkipped).toBe(0);

      expect(smsProvider.sendSms).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining("[CRITICAL HEALTH ALERT]"),
        })
      );
      expect(pushProvider.sendPush).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: vetId,
          title: expect.stringContaining("[HEALTH ESCALATION]"),
        })
      );
      expect(incident.escalationLevel).toBe(1);
      expect(healthRecordRepo.update).toHaveBeenCalled();
    });

    it("should escalate CRITICAL incident >= 48h to LEVEL_2_OWNER_ALERT and alert owner", async () => {
      const incident = createIncident(SeverityLevel.CRITICAL, 50);
      healthRecordRepo.findUnresolvedCriticalCases.mockResolvedValueOnce([incident]);
      escalationLogRepo.hasEscalationBeenLogged.mockResolvedValue(false);
      escalationLogRepo.create.mockImplementation(async (e) => e);
      healthRecordRepo.update.mockResolvedValueOnce(incident);

      const result = await service.processFarmEscalations(farmId);

      expect(result.totalEligibleForEscalation).toBe(1);
      expect(result.escalationsDispatched).toBe(2);
      expect(smsProvider.sendSms).toHaveBeenCalledWith(
        expect.objectContaining({
          to: mockFarm.owner.phone,
          body: expect.stringContaining("[ESCALATION - FARM OWNER]"),
        })
      );
      expect(pushProvider.sendPush).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: ownerId,
        })
      );
      expect(incident.escalationLevel).toBe(2);
    });

    it("should escalate CRITICAL incident >= 72h to LEVEL_3_EMERGENCY_INTERVENTION with quarantine recommendation", async () => {
      const incident = createIncident(SeverityLevel.CRITICAL, 75);
      healthRecordRepo.findUnresolvedCriticalCases.mockResolvedValueOnce([incident]);
      escalationLogRepo.hasEscalationBeenLogged.mockResolvedValue(false);
      escalationLogRepo.create.mockImplementation(async (e) => e);
      healthRecordRepo.update.mockResolvedValueOnce(incident);

      const result = await service.processFarmEscalations(farmId);

      expect(result.totalEligibleForEscalation).toBe(1);
      expect(result.details[0]?.actionTaken).toBe(
        HealthEscalationAction.RECOMMEND_QUARANTINE
      );
      expect(smsProvider.sendSms).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining("[EMERGENCY HEALTH INTERVENTION]"),
        })
      );
      expect(incident.escalationLevel).toBe(3);
    });

    it("should escalate HIGH incident >= 48h to LEVEL_1 and >= 72h to LEVEL_2", async () => {
      const highIncident48 = createIncident(SeverityLevel.HIGH, 50);
      const highIncident72 = createIncident(SeverityLevel.HIGH, 80);

      healthRecordRepo.findUnresolvedCriticalCases.mockResolvedValueOnce([
        highIncident48,
        highIncident72,
      ]);
      escalationLogRepo.hasEscalationBeenLogged.mockResolvedValue(false);
      escalationLogRepo.create.mockImplementation(async (e) => e);

      const result = await service.processFarmEscalations(farmId);

      expect(result.totalEligibleForEscalation).toBe(2);
      expect(highIncident48.escalationLevel).toBe(1);
      expect(highIncident72.escalationLevel).toBe(2);
    });

    it("should skip incident if hours unresolved do not meet threshold", async () => {
      const incidentCritical10h = createIncident(SeverityLevel.CRITICAL, 10);
      const incidentHigh20h = createIncident(SeverityLevel.HIGH, 20);

      healthRecordRepo.findUnresolvedCriticalCases.mockResolvedValueOnce([
        incidentCritical10h,
        incidentHigh20h,
      ]);

      const result = await service.processFarmEscalations(farmId);

      expect(result.totalUnresolvedScanned).toBe(2);
      expect(result.totalEligibleForEscalation).toBe(0);
      expect(result.escalationsDispatched).toBe(0);
      expect(smsProvider.sendSms).not.toHaveBeenCalled();
    });

    it("should skip already dispatched escalations (deduplication)", async () => {
      const incident = createIncident(SeverityLevel.CRITICAL, 30);
      healthRecordRepo.findUnresolvedCriticalCases.mockResolvedValueOnce([incident]);
      escalationLogRepo.hasEscalationBeenLogged.mockResolvedValue(true);

      const result = await service.processFarmEscalations(farmId);

      expect(result.totalEligibleForEscalation).toBe(1);
      expect(result.escalationsDispatched).toBe(0);
      expect(result.escalationsSkipped).toBe(2);
      expect(smsProvider.sendSms).not.toHaveBeenCalled();
      expect(escalationLogRepo.create).not.toHaveBeenCalled();
    });

    it("should preview escalations without dispatching in dryRun mode", async () => {
      const incident = createIncident(SeverityLevel.CRITICAL, 30);
      healthRecordRepo.findUnresolvedCriticalCases.mockResolvedValueOnce([incident]);
      escalationLogRepo.hasEscalationBeenLogged.mockResolvedValue(false);

      const result = await service.processFarmEscalations(farmId, undefined, true);

      expect(result.totalEligibleForEscalation).toBe(1);
      expect(result.escalationsDispatched).toBe(0);
      expect(result.details).toHaveLength(2);
      expect(result.details[0]?.status).toBe(ReminderStatus.PENDING);
      expect(smsProvider.sendSms).not.toHaveBeenCalled();
      expect(escalationLogRepo.create).not.toHaveBeenCalled();
      expect(incident.escalationLevel).toBe(0);
    });

    it("should handle notification failure gracefully", async () => {
      const incident = createIncident(SeverityLevel.CRITICAL, 30);
      healthRecordRepo.findUnresolvedCriticalCases.mockResolvedValueOnce([incident]);
      escalationLogRepo.hasEscalationBeenLogged.mockResolvedValue(false);
      smsProvider.sendSms.mockResolvedValueOnce({
        success: false,
        error: "SMS provider timeout",
      });
      pushProvider.sendPush.mockResolvedValueOnce({ success: true });
      escalationLogRepo.create.mockImplementation(async (e) => e);

      const result = await service.processFarmEscalations(farmId);

      expect(result.escalationsDispatched).toBe(1);
      expect(result.escalationsFailed).toBe(1);
      expect(escalationLogRepo.create).toHaveBeenCalledTimes(2);
    });
  });

  describe("listEscalationLogs", () => {
    it("should return paginated logs", async () => {
      const logEntity = HealthEscalationLogEntity.create({
        id: "log-1",
        farmId,
        healthRecordId: "hr-1",
        animalId,
        level: HealthEscalationLevel.LEVEL_1_STAFF_ALERT,
        actionTaken: HealthEscalationAction.NOTIFY_VET_HERDSMAN,
        recipientUserId: vetId,
        recipientPhone: "+15550000000",
        channel: ReminderChannel.SMS,
        status: ReminderStatus.SENT,
        notes: "Success",
        hoursUnresolved: 25,
      });

      escalationLogRepo.findMany.mockResolvedValueOnce({
        items: [logEntity],
        total: 1,
      });

      const result = await service.listEscalationLogs(farmId, {
        page: 1,
        limit: 10,
      });

      expect(result.items).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.items[0]?.id).toBe("log-1");
    });
  });

  describe("listActiveEscalations", () => {
    it("should return active escalation logs", async () => {
      const logEntity = HealthEscalationLogEntity.create({
        id: "log-1",
        farmId,
        healthRecordId: "hr-1",
        animalId,
        level: HealthEscalationLevel.LEVEL_2_OWNER_ALERT,
        actionTaken: HealthEscalationAction.NOTIFY_FARM_OWNER,
        recipientUserId: ownerId,
        recipientPhone: "+15551234567",
        channel: ReminderChannel.SMS,
        status: ReminderStatus.SENT,
        notes: "Active alert",
        hoursUnresolved: 50,
      });

      escalationLogRepo.findActiveEscalations.mockResolvedValueOnce([logEntity]);

      const result = await service.listActiveEscalations(farmId);

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe("log-1");
    });
  });
});
