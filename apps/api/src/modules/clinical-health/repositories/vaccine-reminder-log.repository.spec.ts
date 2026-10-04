import {
  ReminderChannel,
  ReminderMilestone,
  ReminderStatus,
} from "@vetralink/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { VaccineReminderLogEntity } from "../entities/vaccine-reminder-log.entity";
import { VaccineReminderLogRepository } from "./vaccine-reminder-log.repository";

describe("VaccineReminderLogRepository", () => {
  let repository: VaccineReminderLogRepository;
  let prisma: {
    vaccineReminderLog: {
      create: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
    };
  };

  const farmId = "11111111-1111-1111-1111-111111111111";
  const vaccineRecordId = "22222222-2222-2222-2222-222222222222";
  const animalId = "33333333-3333-3333-3333-333333333333";
  const logId = "44444444-4444-4444-4444-444444444444";

  const rawDbRecord = {
    id: logId,
    farmId,
    vaccineRecordId,
    animalId,
    recipientUserId: "55555555-5555-5555-5555-555555555555",
    recipientPhone: "+1234567890",
    channel: ReminderChannel.SMS,
    milestone: ReminderMilestone.SEVEN_DAYS,
    status: ReminderStatus.SENT,
    message: "Vaccine due in 7 days",
    errorMessage: null,
    dispatchedDate: "2026-09-13",
    dispatchedAt: new Date("2026-09-13T08:00:00.000Z"),
  };

  beforeEach(() => {
    prisma = {
      vaccineReminderLog: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
    };

    repository = new VaccineReminderLogRepository(prisma as unknown as PrismaService);
  });

  describe("create", () => {
    it("should persist reminder log and return domain entity", async () => {
      const entity = VaccineReminderLogEntity.reconstitute({
        ...rawDbRecord,
      });
      prisma.vaccineReminderLog.create.mockResolvedValueOnce(rawDbRecord);

      const result = await repository.create(entity);

      expect(prisma.vaccineReminderLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          farmId,
          vaccineRecordId,
          channel: ReminderChannel.SMS,
          milestone: ReminderMilestone.SEVEN_DAYS,
        }),
      });
      expect(result.id).toBe(logId);
      expect(result.channel).toBe(ReminderChannel.SMS);
    });
  });

  describe("hasReminderBeenSent", () => {
    it("should return true when a record exists for unique constraint", async () => {
      prisma.vaccineReminderLog.findUnique.mockResolvedValueOnce({ id: logId });

      const exists = await repository.hasReminderBeenSent(
        vaccineRecordId,
        ReminderMilestone.SEVEN_DAYS,
        ReminderChannel.SMS,
        "2026-09-13"
      );

      expect(prisma.vaccineReminderLog.findUnique).toHaveBeenCalledWith({
        where: {
          unique_vaccine_reminder_daily: {
            vaccineRecordId,
            milestone: ReminderMilestone.SEVEN_DAYS,
            channel: ReminderChannel.SMS,
            dispatchedDate: "2026-09-13",
          },
        },
        select: { id: true },
      });
      expect(exists).toBe(true);
    });

    it("should return false when no record exists", async () => {
      prisma.vaccineReminderLog.findUnique.mockResolvedValueOnce(null);

      const exists = await repository.hasReminderBeenSent(
        vaccineRecordId,
        ReminderMilestone.SEVEN_DAYS,
        ReminderChannel.SMS,
        "2026-09-13"
      );

      expect(exists).toBe(false);
    });
  });

  describe("findById", () => {
    it("should return domain entity if found", async () => {
      prisma.vaccineReminderLog.findFirst.mockResolvedValueOnce(rawDbRecord);

      const result = await repository.findById(logId, farmId);

      expect(prisma.vaccineReminderLog.findFirst).toHaveBeenCalledWith({
        where: { id: logId, farmId },
      });
      expect(result?.id).toBe(logId);
    });

    it("should return null if not found", async () => {
      prisma.vaccineReminderLog.findFirst.mockResolvedValueOnce(null);

      const result = await repository.findById(logId, farmId);

      expect(result).toBeNull();
    });
  });

  describe("findMany", () => {
    it("should return paginated list of domain entities", async () => {
      prisma.vaccineReminderLog.findMany.mockResolvedValueOnce([rawDbRecord]);
      prisma.vaccineReminderLog.count.mockResolvedValueOnce(1);

      const result = await repository.findMany(farmId, {
        channel: ReminderChannel.SMS,
        milestone: ReminderMilestone.SEVEN_DAYS,
        page: 1,
        limit: 10,
      });

      expect(prisma.vaccineReminderLog.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          farmId,
          channel: ReminderChannel.SMS,
          milestone: ReminderMilestone.SEVEN_DAYS,
        }),
        skip: 0,
        take: 10,
        orderBy: { dispatchedAt: "desc" },
      });
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });
});
