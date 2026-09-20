import {
  AnimalSpecies,
  ConsultationStatus,
  ConsultationType,
} from "@vetralink/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { ConsultationEntity } from "../entities/consultation.entity";
import { ConsultationRepository } from "./consultation.repository";

describe("ConsultationRepository", () => {
  let repository: ConsultationRepository;
  let mockPrisma: any;

  const mockDbRecord = {
    id: "consult-123",
    farmerId: "farmer-1",
    vetId: "vet-1",
    farmId: "farm-1",
    animalId: "animal-1",
    chiefComplaint: "Cow showing signs of acute respiratory distress and high fever.",
    mediaUrls: ["https://s3.amazonaws.com/image.jpg"],
    type: ConsultationType.ASYNC_TICKET,
    status: ConsultationStatus.SUBMITTED,
    roomSessionId: null,
    feeCents: 1500,
    paymentStatus: "UNPAID",
    paymentIntentId: null,
    paymentHeldAt: null,
    paymentCapturedAt: null,
    paymentReleasedAt: null,
    currency: "USD",
    createdAt: new Date("2026-09-20T10:00:00Z"),
    updatedAt: new Date("2026-09-20T10:00:00Z"),
    farmer: { id: "farmer-1", name: "John Doe", email: "john@farm.com" },
    vet: { id: "vet-1", name: "Dr. Smith", email: "smith@vet.com" },
    animal: {
      id: "animal-1",
      name: "Daisy",
      tagNumber: "COW-001",
      species: "COW",
    },
    farm: { id: "farm-1", name: "Green Pastures" },
  };

  beforeEach(() => {
    mockPrisma = {
      consultation: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    repository = new ConsultationRepository(mockPrisma as unknown as PrismaService);
  });

  describe("findById()", () => {
    it("should return mapped entity when found without farmId", async () => {
      mockPrisma.consultation.findFirst.mockResolvedValue(mockDbRecord);

      const result = await repository.findById("consult-123");

      expect(mockPrisma.consultation.findFirst).toHaveBeenCalledWith({
        where: { id: "consult-123" },
        include: expect.any(Object),
      });
      expect(result).not.toBeNull();
      expect(result?.id).toBe("consult-123");
      expect(result?.farmer?.name).toBe("John Doe");
    });

    it("should include farmId in query when provided", async () => {
      mockPrisma.consultation.findFirst.mockResolvedValue(mockDbRecord);

      const result = await repository.findById("consult-123", "farm-1");

      expect(mockPrisma.consultation.findFirst).toHaveBeenCalledWith({
        where: { id: "consult-123", farmId: "farm-1" },
        include: expect.any(Object),
      });
      expect(result).not.toBeNull();
    });

    it("should return null if not found", async () => {
      mockPrisma.consultation.findFirst.mockResolvedValue(null);

      const result = await repository.findById("non-existent");
      expect(result).toBeNull();
    });
  });

  describe("create()", () => {
    it("should insert consultation record into database and return entity", async () => {
      const entity = ConsultationEntity.create({
        farmerId: "farmer-1",
        farmId: "farm-1",
        animalId: "animal-1",
        chiefComplaint: "Cow showing signs of acute respiratory distress and high fever.",
        feeCents: 1500,
      });

      mockPrisma.consultation.create.mockResolvedValue({
        ...mockDbRecord,
        id: entity.id,
      });

      const result = await repository.create(entity);

      expect(mockPrisma.consultation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: entity.id,
          farmerId: "farmer-1",
          farmId: "farm-1",
          status: ConsultationStatus.SUBMITTED,
        }),
        include: expect.any(Object),
      });
      expect(result.id).toBe(entity.id);
    });
  });

  describe("save()", () => {
    it("should update consultation record in database and return entity", async () => {
      const entity = ConsultationEntity.fromPersistence(mockDbRecord);
      entity.assignToVet("vet-2");

      mockPrisma.consultation.update.mockResolvedValue({
        ...mockDbRecord,
        vetId: "vet-2",
        status: ConsultationStatus.ASSIGNED,
      });

      const result = await repository.save(entity);

      expect(mockPrisma.consultation.update).toHaveBeenCalledWith({
        where: { id: entity.id },
        data: expect.objectContaining({
          vetId: "vet-2",
          status: ConsultationStatus.ASSIGNED,
        }),
        include: expect.any(Object),
      });
      expect(result.vetId).toBe("vet-2");
    });
  });

  describe("findByFarm()", () => {
    it("should return paginated consultations for a farm", async () => {
      mockPrisma.consultation.findMany.mockResolvedValue([mockDbRecord]);
      mockPrisma.consultation.count.mockResolvedValue(1);

      const result = await repository.findByFarm("farm-1", {
        page: 1,
        limit: 10,
        status: ConsultationStatus.SUBMITTED,
      });

      expect(mockPrisma.consultation.findMany).toHaveBeenCalledWith({
        where: {
          farmId: "farm-1",
          status: ConsultationStatus.SUBMITTED,
        },
        include: expect.any(Object),
        orderBy: { createdAt: "desc" },
        skip: 0,
        take: 10,
      });
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe("findByFarmer()", () => {
    it("should return paginated consultations for a farmer", async () => {
      mockPrisma.consultation.findMany.mockResolvedValue([mockDbRecord]);
      mockPrisma.consultation.count.mockResolvedValue(1);

      const result = await repository.findByFarmer("farmer-1", {
        page: 1,
        limit: 10,
      });

      expect(mockPrisma.consultation.findMany).toHaveBeenCalledWith({
        where: { farmerId: "farmer-1" },
        include: expect.any(Object),
        orderBy: { createdAt: "desc" },
        skip: 0,
        take: 10,
      });
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe("findTriageQueue()", () => {
    it("should query triage queue with default SUBMITTED filter and asc order", async () => {
      mockPrisma.consultation.findMany.mockResolvedValue([mockDbRecord]);
      mockPrisma.consultation.count.mockResolvedValue(1);

      const result = await repository.findTriageQueue();

      expect(mockPrisma.consultation.findMany).toHaveBeenCalledWith({
        where: { status: ConsultationStatus.SUBMITTED },
        include: expect.any(Object),
        orderBy: { createdAt: "asc" },
        skip: 0,
        take: 20,
      });
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it("should apply search, species, type, and ALL status filters", async () => {
      mockPrisma.consultation.findMany.mockResolvedValue([mockDbRecord]);
      mockPrisma.consultation.count.mockResolvedValue(1);

      const result = await repository.findTriageQueue({
        status: "ALL",
        type: ConsultationType.LIVE_VIDEO,
        species: AnimalSpecies.COW,
        search: "respiratory",
        sortBy: "status",
        sortOrder: "desc",
        page: 2,
        limit: 10,
      });

      expect(mockPrisma.consultation.findMany).toHaveBeenCalledWith({
        where: {
          type: ConsultationType.LIVE_VIDEO,
          animal: { species: AnimalSpecies.COW },
          OR: expect.arrayContaining([
            { chiefComplaint: { contains: "respiratory", mode: "insensitive" } },
          ]),
        },
        include: expect.any(Object),
        orderBy: { status: "desc" },
        skip: 10,
        take: 10,
      });
      expect(result.items).toHaveLength(1);
    });
  });

  describe("getTriageMetrics()", () => {
    it("should compute triage counts, species breakdown, and wait times", async () => {
      const fixedNow = new Date("2026-09-20T12:00:00Z");
      // Pending record created 2 hours ago (120 mins)
      const pendingRecord = {
        createdAt: new Date("2026-09-20T10:00:00Z"),
        animal: { species: "COW" },
      };

      mockPrisma.consultation.count
        .mockResolvedValueOnce(5) // pending
        .mockResolvedValueOnce(2) // assigned
        .mockResolvedValueOnce(1) // inProgress
        .mockResolvedValueOnce(3) // completedToday
        .mockResolvedValueOnce(0) // cancelledToday
        .mockResolvedValueOnce(4) // asyncTickets
        .mockResolvedValueOnce(4); // liveVideos

      mockPrisma.consultation.findMany.mockResolvedValue([pendingRecord]);

      const metrics = await repository.getTriageMetrics(fixedNow);

      expect(metrics.pendingCount).toBe(5);
      expect(metrics.assignedCount).toBe(2);
      expect(metrics.inProgressCount).toBe(1);
      expect(metrics.completedTodayCount).toBe(3);
      expect(metrics.cancelledTodayCount).toBe(0);
      expect(metrics.typeBreakdown.asyncTickets).toBe(4);
      expect(metrics.typeBreakdown.liveVideos).toBe(4);
      expect(metrics.speciesBreakdown["COW"]).toBe(1);
      expect(metrics.avgWaitTimeMinutes).toBe(120);
      expect(metrics.oldestPendingWaitMinutes).toBe(120);
    });

    it("should return zeros for wait times if no pending cases", async () => {
      const fixedNow = new Date("2026-09-20T12:00:00Z");
      mockPrisma.consultation.count.mockResolvedValue(0);
      mockPrisma.consultation.findMany.mockResolvedValue([]);

      const metrics = await repository.getTriageMetrics(fixedNow);

      expect(metrics.pendingCount).toBe(0);
      expect(metrics.avgWaitTimeMinutes).toBe(0);
      expect(metrics.oldestPendingWaitMinutes).toBe(0);
    });
  });

  describe("findTriageCaseDetail()", () => {
    it("should return detailed triage case with animal EHR and vaccine records", async () => {
      const detailDbRecord = {
        ...mockDbRecord,
        farmer: { id: "farmer-1", name: "John Doe", email: "john@farm.com", phone: "+1234567890" },
        farm: { id: "farm-1", name: "Green Pastures", farmType: "DAIRY" },
        animal: {
          id: "animal-1",
          name: "Daisy",
          tagNumber: "COW-001",
          rfidNumber: "RFID-999",
          species: "COW",
          breed: "Holstein",
          gender: "FEMALE",
          dateOfBirth: new Date("2022-01-15"),
          weightKg: "550.50",
          status: "ACTIVE",
          healthRecords: [
            {
              id: "hr-1",
              eventType: "ILLNESS",
              severity: "HIGH",
              symptoms: "Coughing, nasal discharge",
              diagnosis: "Bovine Respiratory Disease",
              treatment: "Antibiotics",
              createdAt: new Date("2026-09-10T08:00:00Z"),
              resolvedAt: null,
            },
          ],
          vaccineRecords: [
            {
              id: "vr-1",
              recordType: "VACCINATION",
              vaccineName: "Bovi-Shield Gold",
              administeredAt: new Date("2026-08-01T10:00:00Z"),
              doseAmount: "2.00",
              doseUnit: "ml",
            },
          ],
        },
      };

      mockPrisma.consultation.findUnique.mockResolvedValue(detailDbRecord);

      const result = await repository.findTriageCaseDetail("consult-123");

      expect(result).not.toBeNull();
      expect(result?.id).toBe("consult-123");
      expect(result?.farmerPhone).toBe("+1234567890");
      expect(result?.farmType).toBe("DAIRY");
      expect(result?.animalDetails?.tagNumber).toBe("COW-001");
      expect(result?.recentHealthRecords).toHaveLength(1);
      expect(result?.recentHealthRecords[0]?.diagnosis).toBe("Bovine Respiratory Disease");
      expect(result?.recentVaccineRecords).toHaveLength(1);
      expect(result?.recentVaccineRecords[0]?.vaccineName).toBe("Bovi-Shield Gold");
    });

    it("should return null if consultation is not found", async () => {
      mockPrisma.consultation.findUnique.mockResolvedValue(null);

      const result = await repository.findTriageCaseDetail("non-existent");
      expect(result).toBeNull();
    });
  });
});
