import {
  AnimalGender,
  AnimalSpecies,
  AnimalStatus,
  ConsultationStatus,
  ConsultationType,
  HealthEventType,
  MilkAnomalySeverity,
  MilkAnomalyStatus,
  MilkSession,
  SeverityLevel,
  UserRole,
  VaccineRecordType,
} from "@vetralink/shared-types";
import {
  EntityNotFoundException,
  ForbiddenOperationException,
  ValidationDomainException,
} from "../../../common/exceptions/domain.exception";
import { IAuditLogRepository } from "../../audit/repositories/audit-log.repository.interface";
import { PrismaService } from "../../prisma/prisma.service";
import { AnimalEhrService } from "./animal-ehr.service";

describe("AnimalEhrService", () => {
  let service: AnimalEhrService;
  let mockPrisma: any;
  let mockAuditLogRepo: jest.Mocked<IAuditLogRepository>;

  const mockAnimalRecord = {
    id: "animal-1",
    farmId: "farm-1",
    tagNumber: "COW-001",
    rfidNumber: "RFID-9999",
    name: "Bella",
    species: AnimalSpecies.COW,
    breed: "Holstein Friesian",
    gender: AnimalGender.FEMALE,
    dateOfBirth: new Date(Date.now() - 730 * 86400000), // ~2 years ago
    weightKg: 580,
    status: AnimalStatus.ACTIVE,
    sireId: "sire-1",
    damId: "dam-1",
    metadata: {},
    syncVersion: 1,
    createdAt: new Date("2024-09-20T00:00:00Z"),
    updatedAt: new Date("2026-09-20T00:00:00Z"),
    deletedAt: null,
    farm: {
      id: "farm-1",
      name: "Dairy Valley Farm",
      farmType: "DAIRY",
      country: "USA",
      ownerId: "farmer-1",
    },
    sire: {
      id: "sire-1",
      tagNumber: "BULL-888",
      species: "COW",
    },
    dam: {
      id: "dam-1",
      tagNumber: "COW-777",
      species: "COW",
    },
  };

  const mockConsultationRecord = {
    id: "consult-123",
    farmerId: "farmer-1",
    vetId: "vet-1",
    farmId: "farm-1",
    animalId: "animal-1",
    chiefComplaint: "Acute drop in milk yield and lethargy",
    mediaUrls: [],
    type: ConsultationType.LIVE_VIDEO,
    status: ConsultationStatus.ASSIGNED,
    roomSessionId: null,
    feeCents: 3000,
    scheduledAt: new Date(),
    assignedAt: new Date(),
    createdAt: new Date("2026-09-20T10:00:00Z"),
    updatedAt: new Date("2026-09-20T10:00:00Z"),
    farm: {
      id: "farm-1",
      name: "Dairy Valley Farm",
    },
  };

  const mockHealthRecords = [
    {
      id: "health-1",
      farmId: "farm-1",
      animalId: "animal-1",
      recordedById: "farmer-1",
      attendingVetId: "vet-1",
      eventType: HealthEventType.ILLNESS,
      severity: SeverityLevel.HIGH,
      symptoms: "High fever, reduced appetite",
      diagnosis: "Acute mastitis",
      treatment: "Intramammary antibiotics",
      cost: 150.0,
      resolvedAt: null,
      escalationLevel: 1,
      createdAt: new Date("2026-09-18T10:00:00Z"),
      recordedBy: { id: "farmer-1", name: "John Farmer" },
      attendingVet: { id: "vet-1", name: "Dr. Alice" },
      attachments: [
        {
          id: "att-1",
          fileName: "lesion.jpg",
          mimeType: "image/jpeg",
          s3Key: "health/lesion.jpg",
          caption: "Udder inflammation",
        },
      ],
      escalations: [],
    },
  ];

  const mockVaccineRecords = [
    {
      id: "vac-1",
      farmId: "farm-1",
      animalId: "animal-1",
      administeredBy: "vet-1",
      recordType: VaccineRecordType.VACCINATION,
      vaccineName: "Bovine Viral Diarrhea (BVD)",
      batchNumber: "BATCH-441",
      doseAmount: 2.0,
      doseUnit: "ml",
      cost: 25.0,
      administeredAt: new Date("2026-03-01T00:00:00Z"),
      nextDueDate: new Date("2026-09-01T00:00:00Z"), // Overdue!
      recorder: { id: "vet-1", name: "Dr. Alice" },
    },
  ];

  const mockWeightLogs = [
    {
      id: "weight-2",
      farmId: "farm-1",
      animalId: "animal-1",
      recordedById: "farmer-1",
      weightKg: 580,
      recordedAt: new Date("2026-09-15T00:00:00Z"),
      notes: "Steady condition",
      recordedBy: { id: "farmer-1", name: "John Farmer" },
    },
    {
      id: "weight-1",
      farmId: "farm-1",
      animalId: "animal-1",
      recordedById: "farmer-1",
      weightKg: 565,
      recordedAt: new Date("2026-08-15T00:00:00Z"),
      notes: "Previous month",
      recordedBy: { id: "farmer-1", name: "John Farmer" },
    },
  ];

  const mockMilkLogs = [
    {
      id: "milk-1",
      farmId: "farm-1",
      animalId: "animal-1",
      recordedById: "farmer-1",
      session: MilkSession.MORNING,
      yieldLiters: 12.5,
      fatPercent: 3.8,
      snfPercent: 8.5,
      loggedDate: new Date("2026-09-19T00:00:00Z"),
    },
    {
      id: "milk-2",
      farmId: "farm-1",
      animalId: "animal-1",
      recordedById: "farmer-1",
      session: MilkSession.EVENING,
      yieldLiters: 11.0,
      fatPercent: 3.9,
      snfPercent: 8.6,
      loggedDate: new Date("2026-09-19T00:00:00Z"),
    },
  ];

  const mockMilkAnomalies = [
    {
      id: "anomaly-1",
      farmId: "farm-1",
      animalId: "animal-1",
      loggedDate: new Date("2026-09-19T00:00:00Z"),
      currentYieldLiters: 23.5,
      baselineYieldLiters: 32.0,
      dropPercentage: 26.56,
      severity: MilkAnomalySeverity.CRITICAL,
      status: MilkAnomalyStatus.DETECTED,
      clinicalNotes: "Sudden >25% drop coincident with mastitis symptoms",
    },
  ];

  const mockPrescriptions = [
    {
      id: "rx-1",
      consultationId: "consult-prev",
      vetId: "vet-1",
      diagnosis: "Clinical mastitis",
      medications: [
        {
          name: "Amoxicillin-Clavulanate",
          dosage: "200mg",
          frequency: "BID",
          durationDays: 5,
          withdrawalDays: 7, // Active withdrawal!
          notes: "Do not supply milk for 7 days",
        },
        {
          name: "Flunixin Meglumine",
          dosage: "50mg",
          frequency: "Once",
          durationDays: 1,
          withdrawalDays: 1, // Expired withdrawal
          notes: "NSAID",
        },
      ],
      pdfS3Key: "prescriptions/rx-1.pdf",
      digitalSignatureHash: "sha256-hash",
      signedAt: new Date(Date.now() - 2 * 86400000), // signed 2 days ago
      vet: { id: "vet-1", name: "Dr. Alice" },
      consultation: { animalId: "animal-1" },
    },
  ];

  beforeEach(() => {
    mockPrisma = {
      consultation: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([mockConsultationRecord]),
        findFirst: jest.fn(),
      },
      animal: {
        findUnique: jest.fn(),
      },
      farm: {
        findUnique: jest.fn(),
      },
      farmMember: {
        findUnique: jest.fn(),
      },
      healthRecord: {
        findMany: jest.fn().mockResolvedValue(mockHealthRecords),
      },
      vaccineRecord: {
        findMany: jest.fn().mockResolvedValue(mockVaccineRecords),
      },
      animalWeightLog: {
        findMany: jest.fn().mockResolvedValue(mockWeightLogs),
      },
      milkLog: {
        findMany: jest.fn().mockResolvedValue(mockMilkLogs),
      },
      milkYieldAnomaly: {
        findMany: jest.fn().mockResolvedValue(mockMilkAnomalies),
      },
      prescription: {
        findMany: jest.fn().mockResolvedValue(mockPrescriptions),
      },
    };

    mockAuditLogRepo = {
      record: jest.fn().mockResolvedValue(undefined),
      findByEntity: jest.fn(),
      findByTraceId: jest.fn(),
      query: jest.fn(),
    } as any;

    service = new AnimalEhrService(mockPrisma as PrismaService, mockAuditLogRepo);
  });

  describe("getConsultationEhr", () => {
    const mockVetUser = {
      sub: "vet-1",
      email: "alice@vet.com",
      role: UserRole.VET,
    };

    it("should return comprehensive EHR with active withdrawal alerts, milk analytics, and highlights", async () => {
      mockPrisma.consultation.findUnique.mockResolvedValue(mockConsultationRecord);
      mockPrisma.animal.findUnique.mockResolvedValue(mockAnimalRecord);

      const ehr = await service.getConsultationEhr("consult-123", mockVetUser as any);

      expect(ehr.animal.id).toBe("animal-1");
      expect(ehr.animal.tagNumber).toBe("COW-001");
      expect(ehr.animal.ageFormatted).toContain("yr");
      expect(ehr.animal.sire?.tagNumber).toBe("BULL-888");
      expect(ehr.animal.dam?.tagNumber).toBe("COW-777");

      // Highlights
      expect(ehr.highlights.totalHealthIncidents).toBe(1);
      expect(ehr.highlights.activeUnresolvedIncidents).toBe(1);
      expect(ehr.highlights.totalVaccinationsAdministered).toBe(1);
      expect(ehr.highlights.overduePreventativeCount).toBe(1); // 2026-09-01 is past
      expect(ehr.highlights.activeWithdrawalAlertsCount).toBe(1); // Amoxicillin has 5 days remaining
      expect(ehr.highlights.lifetimeMedicalCostCents).toBe(17500); // 150 + 25 = 175 * 100

      // Active food safety withdrawal alert
      expect(ehr.activeWithdrawalAlerts).toHaveLength(1);
      expect(ehr.activeWithdrawalAlerts[0]?.medicationName).toBe("Amoxicillin-Clavulanate");
      expect(ehr.activeWithdrawalAlerts[0]?.withdrawalType).toBe("BOTH");
      expect(ehr.activeWithdrawalAlerts[0]?.daysRemaining).toBe(5);

      // Weight trajectory with delta
      expect(ehr.weightHistory).toHaveLength(2);
      expect(ehr.weightHistory[0]?.weightKg).toBe(580);
      expect(ehr.weightHistory[0]?.weightChangeKg).toBe(15); // 580 - 565 = +15 kg

      // Milk production
      expect(ehr.milkProduction).toBeDefined();
      expect(ehr.milkProduction?.recentLogs).toHaveLength(2);
      expect(ehr.milkProduction?.anomalies).toHaveLength(1);
      expect(ehr.milkProduction?.anomalies[0]?.dropPercentage).toBe(26.56);

      // Audit log
      expect(mockAuditLogRepo.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "ANIMAL_EHR_VIEWED",
          entityId: "animal-1",
        }),
      );
    });

    it("should allow farm owner or member to view EHR", async () => {
      mockPrisma.consultation.findUnique.mockResolvedValue(mockConsultationRecord);
      mockPrisma.animal.findUnique.mockResolvedValue(mockAnimalRecord);

      const farmerUser = {
        sub: "farmer-1",
        email: "farmer@farm.com",
        role: UserRole.FARMER,
      };

      const ehr = await service.getConsultationEhr("consult-123", farmerUser as any);
      expect(ehr.animal.tagNumber).toBe("COW-001");
    });

    it("should allow admin or super admin to view EHR", async () => {
      mockPrisma.consultation.findUnique.mockResolvedValue(mockConsultationRecord);
      mockPrisma.animal.findUnique.mockResolvedValue(mockAnimalRecord);

      const adminUser = {
        sub: "admin-1",
        email: "admin@vetralink.pro",
        role: UserRole.ADMIN,
      };

      const ehr = await service.getConsultationEhr("consult-123", adminUser as any);
      expect(ehr.animal.tagNumber).toBe("COW-001");
    });

    it("should throw ForbiddenOperationException if user is not authorized for this consultation", async () => {
      mockPrisma.consultation.findUnique.mockResolvedValue(mockConsultationRecord);
      mockPrisma.farmMember.findUnique.mockResolvedValue(null);

      const unauthorizedUser = {
        sub: "unauthorized-vet-2",
        email: "other@vet.com",
        role: UserRole.VET,
      };

      await expect(
        service.getConsultationEhr("consult-123", unauthorizedUser as any),
      ).rejects.toThrow(ForbiddenOperationException);
    });

    it("should throw ValidationDomainException if consultation has no linked animal", async () => {
      mockPrisma.consultation.findUnique.mockResolvedValue({
        ...mockConsultationRecord,
        animalId: null,
      });

      await expect(
        service.getConsultationEhr("consult-123", mockVetUser as any),
      ).rejects.toThrow(ValidationDomainException);
    });

    it("should throw EntityNotFoundException if consultation does not exist", async () => {
      mockPrisma.consultation.findUnique.mockResolvedValue(null);

      await expect(
        service.getConsultationEhr("non-existent", mockVetUser as any),
      ).rejects.toThrow(EntityNotFoundException);
    });
  });

  describe("getAnimalEhr", () => {
    it("should allow farm owner to view animal EHR directly", async () => {
      mockPrisma.animal.findUnique.mockResolvedValue(mockAnimalRecord);
      mockPrisma.farmMember.findUnique.mockResolvedValue(null);
      mockPrisma.farm.findUnique.mockResolvedValue(mockAnimalRecord.farm);

      const farmerUser = {
        sub: "farmer-1",
        email: "farmer@farm.com",
        role: UserRole.FARMER,
      };

      const ehr = await service.getAnimalEhr("animal-1", farmerUser as any);
      expect(ehr.animal.id).toBe("animal-1");
      expect(ehr.animal.species).toBe(AnimalSpecies.COW);
    });

    it("should allow attending vet on an active consultation to view animal EHR", async () => {
      mockPrisma.animal.findUnique.mockResolvedValue(mockAnimalRecord);
      mockPrisma.farmMember.findUnique.mockResolvedValue(null);
      mockPrisma.farm.findUnique.mockResolvedValue(mockAnimalRecord.farm);
      mockPrisma.consultation.findFirst.mockResolvedValue(mockConsultationRecord);

      const vetUser = {
        sub: "vet-1",
        email: "alice@vet.com",
        role: UserRole.VET,
      };

      const ehr = await service.getAnimalEhr("animal-1", vetUser as any);
      expect(ehr.animal.id).toBe("animal-1");
    });

    it("should throw ForbiddenOperationException if unrelated user attempts direct animal EHR view", async () => {
      mockPrisma.animal.findUnique.mockResolvedValue(mockAnimalRecord);
      mockPrisma.farmMember.findUnique.mockResolvedValue(null);
      mockPrisma.farm.findUnique.mockResolvedValue({
        ...mockAnimalRecord.farm,
        ownerId: "other-owner",
      });
      mockPrisma.consultation.findFirst.mockResolvedValue(null);

      const stranger = {
        sub: "stranger-1",
        email: "stranger@other.com",
        role: UserRole.FARMER,
      };

      await expect(service.getAnimalEhr("animal-1", stranger as any)).rejects.toThrow(
        ForbiddenOperationException,
      );
    });

    it("should throw EntityNotFoundException if animal does not exist", async () => {
      mockPrisma.animal.findUnique.mockResolvedValue(null);

      await expect(
        service.getAnimalEhr("non-existent", { sub: "admin-1", role: UserRole.ADMIN } as any),
      ).rejects.toThrow(EntityNotFoundException);
    });
  });
});
