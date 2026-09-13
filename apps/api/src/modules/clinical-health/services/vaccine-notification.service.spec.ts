import {
  AnimalGender,
  AnimalSpecies,
  ReminderChannel,
  ReminderMilestone,
  ReminderStatus,
  VaccineRecordType,
} from "@vetralink/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { VaccineRecordEntity } from "../entities/vaccine-record.entity";
import { VaccineReminderLogEntity } from "../entities/vaccine-reminder-log.entity";
import { IVaccineRecordRepository } from "../repositories/vaccine-record.repository.interface";
import { IVaccineReminderLogRepository } from "../repositories/vaccine-reminder-log.repository.interface";
import {
  MockPushNotificationProvider,
  MockSmsNotificationProvider,
} from "../providers/mock-notification.provider";
import { VaccineNotificationService } from "./vaccine-notification.service";

describe("VaccineNotificationService", () => {
  let service: VaccineNotificationService;
  let vaccineRecordRepository: jest.Mocked<IVaccineRecordRepository>;
  let reminderLogRepository: jest.Mocked<IVaccineReminderLogRepository>;
  let smsProvider: MockSmsNotificationProvider;
  let pushProvider: MockPushNotificationProvider;
  let prisma: {
    farm: {
      findUnique: jest.Mock;
    };
  };

  const farmId = "11111111-1111-1111-1111-111111111111";
  const animalId = "22222222-2222-2222-2222-222222222222";
  const recordId = "33333333-3333-3333-3333-333333333333";
  const ownerId = "44444444-4444-4444-4444-444444444444";

  const asOfDate = new Date("2026-09-13T08:00:00.000Z");

  const createDueRecord = (daysFromToday: number) => {
    const dueDate = new Date(asOfDate);
    dueDate.setDate(dueDate.getDate() + daysFromToday);

    return new VaccineRecordEntity({
      id: recordId,
      farmId,
      animalId,
      administeredById: ownerId,
      recordType: VaccineRecordType.VACCINATION,
      vaccineName: "Foot and Mouth Disease (FMD) Vaccine",
      batchNumber: null,
      doseAmount: 2.0,
      doseUnit: "ml",
      cost: 15.0,
      notes: null,
      administeredAt: new Date("2026-03-13"),
      nextDueDate: dueDate,
      syncVersion: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      animal: {
        id: animalId,
        tagNumber: "COW-042",
        name: "Buttercup",
        species: AnimalSpecies.COW,
        breed: "Jersey",
        gender: AnimalGender.FEMALE,
      },
    });
  };

  beforeEach(() => {
    vaccineRecordRepository = {
      create: jest.fn(),
      update: jest.fn(),
      findById: jest.fn(),
      findMany: jest.fn(),
      getScheduleCounts: jest.fn(),
      findUpcoming: jest.fn(),
      findRecordsForReminderScan: jest.fn(),
      delete: jest.fn(),
    };

    reminderLogRepository = {
      create: jest.fn().mockImplementation(async (entity) => entity),
      hasReminderBeenSent: jest.fn().mockResolvedValue(false),
      findById: jest.fn(),
      findMany: jest.fn(),
    };

    smsProvider = new MockSmsNotificationProvider();
    pushProvider = new MockPushNotificationProvider();

    prisma = {
      farm: {
        findUnique: jest.fn().mockResolvedValue({
          id: farmId,
          ownerId,
          owner: {
            id: ownerId,
            name: "John Farmer",
            phone: "+15551234567",
            email: "farmer@farm.com",
          },
          members: [],
        }),
      },
    };

    service = new VaccineNotificationService(
      vaccineRecordRepository,
      reminderLogRepository,
      smsProvider,
      pushProvider,
      prisma as unknown as PrismaService
    );
  });

  describe("processFarmDueReminders", () => {
    it("should scan due records and dispatch SMS and Push notifications for SEVEN_DAYS milestone", async () => {
      const record = createDueRecord(7);
      vaccineRecordRepository.findRecordsForReminderScan.mockResolvedValueOnce([
        record,
      ]);

      const result = await service.processFarmDueReminders(farmId, asOfDate);

      expect(vaccineRecordRepository.findRecordsForReminderScan).toHaveBeenCalledWith(
        farmId,
        7,
        asOfDate
      );
      expect(result.totalScanned).toBe(1);
      expect(result.remindersDispatched).toBe(2); // 1 SMS + 1 Push
      expect(smsProvider.sentMessages).toHaveLength(1);
      expect(smsProvider.sentMessages[0]!.to).toBe("+15551234567");
      expect(smsProvider.sentMessages[0]!.body).toContain("Advance Notice");
      expect(pushProvider.sentNotifications).toHaveLength(1);
      expect(reminderLogRepository.create).toHaveBeenCalledTimes(2);
    });

    it("should correctly identify OVERDUE milestone for past due dates", async () => {
      const record = createDueRecord(-5); // 5 days past due
      vaccineRecordRepository.findRecordsForReminderScan.mockResolvedValueOnce([
        record,
      ]);

      const result = await service.processFarmDueReminders(farmId, asOfDate);

      expect(result.remindersDispatched).toBe(2);
      expect(smsProvider.sentMessages[0]!.body).toContain("ALERT");
      expect(smsProvider.sentMessages[0]!.body).toContain("OVERDUE");
      expect(result.details[0]!.milestone).toBe(ReminderMilestone.OVERDUE);
    });

    it("should correctly identify DUE_TODAY milestone", async () => {
      const record = createDueRecord(0); // Due today
      vaccineRecordRepository.findRecordsForReminderScan.mockResolvedValueOnce([
        record,
      ]);

      const result = await service.processFarmDueReminders(farmId, asOfDate);

      expect(result.remindersDispatched).toBe(2);
      expect(smsProvider.sentMessages[0]!.body).toContain("due TODAY");
      expect(result.details[0]!.milestone).toBe(ReminderMilestone.DUE_TODAY);
    });

    it("should skip dispatch if reminder was already sent today for that milestone", async () => {
      const record = createDueRecord(3);
      vaccineRecordRepository.findRecordsForReminderScan.mockResolvedValueOnce([
        record,
      ]);
      reminderLogRepository.hasReminderBeenSent.mockResolvedValue(true);

      const result = await service.processFarmDueReminders(farmId, asOfDate);

      expect(result.remindersDispatched).toBe(0);
      expect(result.remindersSkipped).toBe(2);
      expect(smsProvider.sentMessages).toHaveLength(0);
      expect(pushProvider.sentNotifications).toHaveLength(0);
      expect(reminderLogRepository.create).not.toHaveBeenCalled();
    });

    it("should preview without sending when dryRun is true", async () => {
      const record = createDueRecord(3);
      vaccineRecordRepository.findRecordsForReminderScan.mockResolvedValueOnce([
        record,
      ]);

      const result = await service.processFarmDueReminders(
        farmId,
        asOfDate,
        7,
        true
      );

      expect(result.remindersDispatched).toBe(0);
      expect(smsProvider.sentMessages).toHaveLength(0);
      expect(pushProvider.sentNotifications).toHaveLength(0);
      expect(reminderLogRepository.create).not.toHaveBeenCalled();
      expect(result.details[0]!.status).toBe(ReminderStatus.PENDING);
    });

    it("should record failed status when provider errors without crashing", async () => {
      const record = createDueRecord(3);
      vaccineRecordRepository.findRecordsForReminderScan.mockResolvedValueOnce([
        record,
      ]);
      smsProvider.shouldFail = true;

      const result = await service.processFarmDueReminders(farmId, asOfDate);

      expect(result.remindersDispatched).toBe(1); // Push succeeded
      expect(result.remindersFailed).toBe(1); // SMS failed
      expect(reminderLogRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: ReminderStatus.FAILED,
          channel: ReminderChannel.SMS,
        })
      );
    });
  });

  describe("dispatchReminderForRecord", () => {
    it("should dispatch reminders for a specific record ID", async () => {
      const record = createDueRecord(3);
      vaccineRecordRepository.findById.mockResolvedValueOnce(record);

      const details = await service.dispatchReminderForRecord(
        recordId,
        farmId,
        ReminderMilestone.THREE_DAYS,
        ReminderChannel.SMS,
        asOfDate
      );

      expect(details).toHaveLength(1);
      expect(details[0]!.status).toBe(ReminderStatus.SENT);
      expect(details[0]!.channel).toBe(ReminderChannel.SMS);
    });

    it("should return empty array if record does not exist", async () => {
      vaccineRecordRepository.findById.mockResolvedValueOnce(null);

      const details = await service.dispatchReminderForRecord(
        recordId,
        farmId,
        ReminderMilestone.THREE_DAYS
      );

      expect(details).toEqual([]);
    });
  });

  describe("listReminderLogs", () => {
    it("should query repository with filters and return paginated DTO", async () => {
      const logEntity = VaccineReminderLogEntity.create({
        farmId,
        vaccineRecordId: recordId,
        animalId,
        recipientUserId: ownerId,
        recipientPhone: "+15551234567",
        channel: ReminderChannel.SMS,
        milestone: ReminderMilestone.SEVEN_DAYS,
        status: ReminderStatus.SENT,
        message: "Due in 7 days",
        errorMessage: null,
        dispatchedDate: "2026-09-13",
      });

      reminderLogRepository.findMany.mockResolvedValueOnce({
        items: [logEntity],
        total: 1,
      });

      const result = await service.listReminderLogs(farmId, {
        page: 1,
        limit: 10,
        channel: ReminderChannel.SMS,
      });

      expect(reminderLogRepository.findMany).toHaveBeenCalledWith(
        farmId,
        expect.objectContaining({
          page: 1,
          limit: 10,
          channel: ReminderChannel.SMS,
        })
      );
      expect(result.items).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.items[0]!.farmId).toBe(farmId);
    });
  });
});
