import {
  AnimalSpecies,
  FoodSafetyRiskLevel,
  JwtPayload,
  MedicationFormulation,
  MedicationRoute,
  PrescriptionStatus,
  UserRole,
  UserStatus,
} from "@vetralink/shared-types";
import {
  EntityNotFoundException,
  ForbiddenOperationException,
} from "../../../common/exceptions/domain.exception";
import { IAuditLogRepository } from "../../audit/repositories/audit-log.repository.interface";
import {
  IPushNotificationProvider,
  ISmsNotificationProvider,
} from "../../clinical-health/providers/notification-provider.interface";
import { IMailService } from "../../mail/interfaces/mail-service.interface";
import { PrismaService } from "../../prisma/prisma.service";
import { ConsultationEntity } from "../entities/consultation.entity";
import { PrescriptionEntity } from "../entities/prescription.entity";
import { IConsultationRepository } from "../repositories/consultation.repository.interface";
import { IPrescriptionRepository } from "../repositories/prescription.repository.interface";
import { FoodSafetyService } from "./food-safety.service";

describe("FoodSafetyService", () => {
  let service: FoodSafetyService;
  let mockConsultationRepo: jest.Mocked<IConsultationRepository>;
  let mockPrescriptionRepo: jest.Mocked<IPrescriptionRepository>;
  let mockAuditLogRepo: jest.Mocked<IAuditLogRepository>;
  let mockPrisma: any;
  let mockPushProvider: jest.Mocked<IPushNotificationProvider>;
  let mockSmsProvider: jest.Mocked<ISmsNotificationProvider>;
  let mockMailService: jest.Mocked<IMailService>;

  const mockAssignedVet: JwtPayload = {
    sub: "vet-1",
    email: "vet@clinic.com",
    role: UserRole.VET,
    status: UserStatus.ACTIVE,
  };

  const mockOtherVet: JwtPayload = {
    sub: "vet-stranger",
    email: "stranger@clinic.com",
    role: UserRole.VET,
    status: UserStatus.ACTIVE,
  };

  const mockAdmin: JwtPayload = {
    sub: "admin-1",
    email: "admin@clinic.com",
    role: UserRole.ADMIN,
    status: UserStatus.ACTIVE,
  };

  const mockFarmer: JwtPayload = {
    sub: "farmer-1",
    email: "farmer@farm.com",
    role: UserRole.FARMER,
    status: UserStatus.ACTIVE,
  };

  const mockOtherFarmer: JwtPayload = {
    sub: "farmer-other",
    email: "other@farm.com",
    role: UserRole.FARMER,
    status: UserStatus.ACTIVE,
  };

  const sampleMedication = {
    name: "Oxytetracycline 200mg/ml",
    formulation: MedicationFormulation.INJECTABLE,
    route: MedicationRoute.INTRAMUSCULAR,
    dosage: "20 mg/kg",
    frequency: "Once daily",
    durationDays: 5,
    withdrawalDays: 21,
    withdrawalDaysMilk: 7,
    withdrawalDaysMeat: 21,
    instructions: "Deep IM injection in neck area.",
  };

  const sampleAnimal = {
    id: "animal-1",
    farmId: "farm-1",
    tagNumber: "COW-101",
    name: "Bessie",
    species: AnimalSpecies.COW,
    status: "ACTIVE",
  };

  const sampleConsultation = ConsultationEntity.fromPersistence({
    id: "consult-1",
    farmerId: "farmer-1",
    vetId: "vet-1",
    farmId: "farm-1",
    animalId: "animal-1",
    chiefComplaint: "High fever and cough.",
    mediaUrls: [],
    type: "LIVE_VIDEO" as any,
    status: "IN_PROGRESS" as any,
    roomSessionId: "room-1",
    feeCents: 3000,
    paymentStatus: "AUTHORIZED" as any,
    paymentIntentId: "pi_123",
    paymentHeldAt: new Date(),
    paymentCapturedAt: null,
    paymentReleasedAt: null,
    currency: "USD",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const samplePrescription = PrescriptionEntity.create({
    consultationId: "consult-1",
    vetId: "vet-1",
    diagnosis: "Bovine Respiratory Disease Complex",
    medications: [sampleMedication],
  });

  beforeEach(() => {
    mockConsultationRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findById: jest.fn(),
      findByFarm: jest.fn(),
      findByFarmer: jest.fn(),
      findTriageQueue: jest.fn(),
      findTriageCaseDetail: jest.fn(),
      getTriageMetrics: jest.fn(),
      countActiveConsultationsByVet: jest.fn(),
      findConflictingConsultations: jest.fn(),
    };

    mockPrescriptionRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      findByConsultationId: jest.fn(),
      save: jest.fn(),
    };

    mockAuditLogRepo = {
      record: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<IAuditLogRepository>;

    mockPushProvider = {
      sendPush: jest.fn().mockResolvedValue({ success: true }),
    };

    mockSmsProvider = {
      sendSms: jest.fn().mockResolvedValue({ success: true }),
    };

    mockMailService = {
      sendEmail: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<IMailService>;

    mockPrisma = {
      animal: {
        findUnique: jest.fn().mockResolvedValue(sampleAnimal),
        findMany: jest.fn().mockResolvedValue([sampleAnimal]),
      },
      prescription: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "rx-1",
            consultationId: "consult-1",
            signedAt: new Date(),
            createdAt: new Date(),
            medications: [sampleMedication],
            consultation: {
              animalId: "animal-1",
            },
          },
        ]),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: "farmer-1",
          name: "John Farmer",
          email: "john@farm.com",
          phone: "+1234567890",
        }),
      },
      farmMember: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.farmId_userId?.userId === "farmer-1") {
            return Promise.resolve({ farmId: "farm-1", userId: "farmer-1" });
          }
          return Promise.resolve(null);
        }),
      },
    };

    service = new FoodSafetyService(
      mockConsultationRepo,
      mockPrescriptionRepo,
      mockAuditLogRepo,
      mockPrisma as PrismaService,
      mockPushProvider,
      mockSmsProvider,
      mockMailService,
    );
  });

  describe("getConsultationWithdrawalStatus", () => {
    it("should throw EntityNotFoundException if consultation does not exist", async () => {
      mockConsultationRepo.findById.mockResolvedValue(null);

      await expect(
        service.getConsultationWithdrawalStatus("non-existent", mockAssignedVet),
      ).rejects.toThrow(EntityNotFoundException);
    });

    it("should throw ForbiddenOperationException if farmer belongs to another farm", async () => {
      mockConsultationRepo.findById.mockResolvedValue(sampleConsultation);

      await expect(
        service.getConsultationWithdrawalStatus("consult-1", mockOtherFarmer),
      ).rejects.toThrow(ForbiddenOperationException);
    });

    it("should return food safety status with active withdrawal for assigned vet", async () => {
      mockConsultationRepo.findById.mockResolvedValue(sampleConsultation);
      mockPrescriptionRepo.findByConsultationId.mockResolvedValue(
        samplePrescription,
      );

      const result = await service.getConsultationWithdrawalStatus(
        "consult-1",
        mockAssignedVet,
      );

      expect(result).toBeDefined();
      expect(result.animalTag).toBe("COW-101");
      expect(result.riskLevel).toBe(FoodSafetyRiskLevel.CRITICAL_BOTH);
      expect(result.isMilkWithdrawn).toBe(true);
      expect(result.isMeatWithdrawn).toBe(true);
      expect(result.activeMedications).toHaveLength(1);
      expect(result.warningMessage).toContain("COW-101");
    });
  });

  describe("getAnimalWithdrawalStatus", () => {
    it("should throw EntityNotFoundException if animal not found", async () => {
      mockPrisma.animal.findUnique.mockResolvedValue(null);

      await expect(
        service.getAnimalWithdrawalStatus("non-existent", mockAssignedVet),
      ).rejects.toThrow(EntityNotFoundException);
    });

    it("should return animal withdrawal status for farm member farmer", async () => {
      const result = await service.getAnimalWithdrawalStatus(
        "animal-1",
        mockFarmer,
      );

      expect(result).toBeDefined();
      expect(result.animalId).toBe("animal-1");
      expect(result.riskLevel).toBe(FoodSafetyRiskLevel.CRITICAL_BOTH);
    });
  });

  describe("getFarmWithdrawalAlerts", () => {
    it("should throw ForbiddenOperationException if farmer is not member of farm", async () => {
      await expect(
        service.getFarmWithdrawalAlerts("farm-1", mockOtherFarmer),
      ).rejects.toThrow(ForbiddenOperationException);
    });

    it("should return list of animals currently under withdrawal for farm", async () => {
      const result = await service.getFarmWithdrawalAlerts(
        "farm-1",
        mockFarmer,
      );

      expect(result).toBeDefined();
      expect(result.farmId).toBe("farm-1");
      expect(result.totalAnimalsUnderWithdrawal).toBe(1);
      expect(result.animalsWithMilkWithdrawal).toBe(1);
      expect(result.animalsWithMeatWithdrawal).toBe(1);
      expect(result.alerts).toHaveLength(1);
      expect(result.alerts[0].animalTag).toBe("COW-101");
    });
  });

  describe("dispatchWithdrawalAlert", () => {
    it("should throw ForbiddenOperationException if unassigned vet attempts dispatch", async () => {
      mockConsultationRepo.findById.mockResolvedValue(sampleConsultation);

      await expect(
        service.dispatchWithdrawalAlert("consult-1", mockOtherVet),
      ).rejects.toThrow(ForbiddenOperationException);
    });

    it("should dispatch push, sms, and email notifications to the farmer and record audit log", async () => {
      mockConsultationRepo.findById.mockResolvedValue(sampleConsultation);
      mockPrescriptionRepo.findByConsultationId.mockResolvedValue(
        samplePrescription,
      );

      const result = await service.dispatchWithdrawalAlert(
        "consult-1",
        mockAssignedVet,
        "trace-1",
      );

      expect(result).toBeDefined();
      expect(result.riskLevel).toBe(FoodSafetyRiskLevel.CRITICAL_BOTH);
      expect(result.notificationsSent.push).toBe(true);
      expect(result.notificationsSent.sms).toBe(true);
      expect(result.notificationsSent.email).toBe(true);

      expect(mockPushProvider.sendPush).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "farmer-1",
          title: expect.stringContaining("FOOD SAFETY ALERT"),
        }),
      );

      expect(mockSmsProvider.sendSms).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "+1234567890",
          body: expect.stringContaining("FOOD SAFETY ALERT"),
        }),
      );

      expect(mockMailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "john@farm.com",
          subject: expect.stringContaining("FOOD SAFETY ALERT"),
        }),
      );

      expect(mockAuditLogRepo.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "FOOD_SAFETY_ALERT_DISPATCHED",
          entityId: "consult-1",
          userId: "vet-1",
          traceId: "trace-1",
        }),
      );
    });
  });
});
