import {
  HealthEscalationAction,
  HealthEscalationLevel,
  ReminderChannel,
  ReminderStatus,
} from "@vetralink/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { HealthEscalationLogEntity } from "../entities/health-escalation-log.entity";
import { HealthEscalationLogRepository } from "./health-escalation-log.repository";

describe("HealthEscalationLogRepository", () => {
  let repository: HealthEscalationLogRepository;
  let prisma: {
    healthIncidentEscalationLog: {
      create: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
    };
  };

  const farmId = "11111111-1111-1111-1111-111111111111";
  const healthRecordId = "22222222-2222-2222-2222-222222222222";
  const animalId = "33333333-3333-3333-3333-333333333333";
  const logId = "44444444-4444-4444-4444-444444444444";

  const rawDbRecord = {
    id: logId,
    farmId,
    healthRecordId,
    animalId,
    recipientUserId: "55555555-5555-5555-5555-555555555555",
    recipientPhone: "+1234567890",
    level: HealthEscalationLevel.LEVEL_1_STAFF_ALERT,
    actionTaken: HealthEscalationAction.NOTIFY_VET_HERDSMAN,
    channel: ReminderChannel.SMS,
    status: ReminderStatus.SENT,
    notes: "Escalated critical incident to vet staff",
    hoursUnresolved: 24,
    dispatchedAt: new Date("2026-09-13T08:00:00.000Z"),
  };

  beforeEach(() => {
    prisma = {
      healthIncidentEscalationLog: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
    };

    repository = new HealthEscalationLogRepository(
      prisma as unknown as PrismaService
    );
  });

  describe("create", () => {
    it("should persist escalation log and return domain entity", async () => {
      const entity = HealthEscalationLogEntity.reconstitute(rawDbRecord);
      prisma.healthIncidentEscalationLog.create.mockResolvedValueOnce(rawDbRecord);

      const result = await repository.create(entity);

      expect(prisma.healthIncidentEscalationLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          farmId,
          healthRecordId,
          level: HealthEscalationLevel.LEVEL_1_STAFF_ALERT,
          actionTaken: HealthEscalationAction.NOTIFY_VET_HERDSMAN,
          channel: ReminderChannel.SMS,
        }),
      });
      expect(result.id).toBe(logId);
      expect(result.level).toBe(HealthEscalationLevel.LEVEL_1_STAFF_ALERT);
    });
  });

  describe("hasEscalationBeenLogged", () => {
    it("should return true when a record exists for unique constraint", async () => {
      prisma.healthIncidentEscalationLog.findUnique.mockResolvedValueOnce({
        id: logId,
      });

      const exists = await repository.hasEscalationBeenLogged(
        healthRecordId,
        HealthEscalationLevel.LEVEL_1_STAFF_ALERT,
        ReminderChannel.SMS
      );

      expect(
        prisma.healthIncidentEscalationLog.findUnique
      ).toHaveBeenCalledWith({
        where: {
          unique_health_incident_escalation_level: {
            healthRecordId,
            level: HealthEscalationLevel.LEVEL_1_STAFF_ALERT,
            channel: ReminderChannel.SMS,
          },
        },
        select: { id: true },
      });
      expect(exists).toBe(true);
    });

    it("should return false when no record exists", async () => {
      prisma.healthIncidentEscalationLog.findUnique.mockResolvedValueOnce(null);

      const exists = await repository.hasEscalationBeenLogged(
        healthRecordId,
        HealthEscalationLevel.LEVEL_1_STAFF_ALERT,
        ReminderChannel.SMS
      );

      expect(exists).toBe(false);
    });
  });

  describe("findById", () => {
    it("should return domain entity if found", async () => {
      prisma.healthIncidentEscalationLog.findFirst.mockResolvedValueOnce(rawDbRecord);

      const result = await repository.findById(logId, farmId);

      expect(prisma.healthIncidentEscalationLog.findFirst).toHaveBeenCalledWith({
        where: { id: logId, farmId },
      });
      expect(result?.id).toBe(logId);
    });

    it("should return null if not found", async () => {
      prisma.healthIncidentEscalationLog.findFirst.mockResolvedValueOnce(null);

      const result = await repository.findById(logId, farmId);

      expect(result).toBeNull();
    });
  });

  describe("findMany", () => {
    it("should return paginated list of domain entities", async () => {
      prisma.healthIncidentEscalationLog.findMany.mockResolvedValueOnce([
        rawDbRecord,
      ]);
      prisma.healthIncidentEscalationLog.count.mockResolvedValueOnce(1);

      const result = await repository.findMany(farmId, {
        channel: ReminderChannel.SMS,
        level: HealthEscalationLevel.LEVEL_1_STAFF_ALERT,
        page: 1,
        limit: 10,
      });

      expect(prisma.healthIncidentEscalationLog.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          farmId,
          channel: ReminderChannel.SMS,
          level: HealthEscalationLevel.LEVEL_1_STAFF_ALERT,
        }),
        skip: 0,
        take: 10,
        orderBy: { dispatchedAt: "desc" },
      });
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe("findActiveEscalations", () => {
    it("should return escalation logs for unresolved health incidents on farm", async () => {
      prisma.healthIncidentEscalationLog.findMany.mockResolvedValueOnce([
        rawDbRecord,
      ]);

      const result = await repository.findActiveEscalations(farmId);

      expect(prisma.healthIncidentEscalationLog.findMany).toHaveBeenCalledWith({
        where: {
          farmId,
          healthRecord: {
            resolvedAt: null,
          },
        },
        orderBy: { dispatchedAt: "desc" },
      });
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe(logId);
    });
  });
});
