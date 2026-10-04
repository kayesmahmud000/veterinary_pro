import { PrismaService } from "../../prisma/prisma.service";
import { AnimalWeightRepository } from "./animal-weight.repository";
import { AnimalWeightLogEntity } from "../entities/animal-weight-log.entity";

describe("AnimalWeightRepository", () => {
  let repository: AnimalWeightRepository;
  let prisma: jest.Mocked<PrismaService>;

  const farmId = "11111111-1111-1111-1111-111111111111";
  const animalId = "22222222-2222-2222-2222-222222222222";
  const userId = "33333333-3333-3333-3333-333333333333";

  const mockDbRow = {
    id: "44444444-4444-4444-4444-444444444444",
    farmId,
    animalId,
    recordedById: userId,
    weightKg: 520.5 as any,
    recordedAt: new Date("2024-03-01T10:00:00.000Z"),
    notes: "Scale calibrated",
    syncVersion: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    recordedBy: { name: "Dr. Smith" },
  };

  const mockEntity = AnimalWeightLogEntity.create({
    id: mockDbRow.id,
    farmId,
    animalId,
    recordedById: userId,
    weightKg: 520.5,
    recordedAt: mockDbRow.recordedAt,
    notes: "Scale calibrated",
    recordedByName: "Dr. Smith",
  });

  beforeEach(() => {
    prisma = {
      animalWeightLog: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        deleteMany: jest.fn(),
      },
    } as unknown as jest.Mocked<PrismaService>;

    repository = new AnimalWeightRepository(prisma);
  });

  describe("create", () => {
    it("should create record and return AnimalWeightLogEntity", async () => {
      (prisma.animalWeightLog.create as jest.Mock).mockResolvedValueOnce(mockDbRow);

      const result = await repository.create(mockEntity);

      expect(prisma.animalWeightLog.create).toHaveBeenCalled();
      expect(result.id).toBe(mockDbRow.id);
      expect(result.weightKg).toBe(520.5);
      expect(result.recordedByName).toBe("Dr. Smith");
    });
  });

  describe("findByAnimalId", () => {
    it("should return paginated weight logs", async () => {
      (prisma.animalWeightLog.findMany as jest.Mock).mockResolvedValueOnce([mockDbRow]);
      (prisma.animalWeightLog.count as jest.Mock).mockResolvedValueOnce(1);

      const result = await repository.findByAnimalId(animalId, farmId, { page: 1, limit: 10 });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(prisma.animalWeightLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ animalId, farmId }),
          skip: 0,
          take: 10,
        })
      );
    });
  });

  describe("findAllChronological", () => {
    it("should return all records sorted ascending by recordedAt", async () => {
      (prisma.animalWeightLog.findMany as jest.Mock).mockResolvedValueOnce([mockDbRow]);

      const result = await repository.findAllChronological(animalId, farmId);

      expect(result).toHaveLength(1);
      expect(prisma.animalWeightLog.findMany).toHaveBeenCalledWith({
        where: { animalId, farmId },
        orderBy: { recordedAt: "asc" },
        include: { recordedBy: { select: { name: true } } },
      });
    });
  });

  describe("findLatestByAnimalId", () => {
    it("should return the latest record by recordedAt desc", async () => {
      (prisma.animalWeightLog.findFirst as jest.Mock).mockResolvedValueOnce(mockDbRow);

      const result = await repository.findLatestByAnimalId(animalId, farmId);

      expect(result).not.toBeNull();
      expect(result?.weightKg).toBe(520.5);
    });
  });

  describe("delete", () => {
    it("should return true when count > 0", async () => {
      (prisma.animalWeightLog.deleteMany as jest.Mock).mockResolvedValueOnce({ count: 1 });

      const result = await repository.delete(mockDbRow.id, farmId);
      expect(result).toBe(true);
      expect(prisma.animalWeightLog.deleteMany).toHaveBeenCalledWith({
        where: { id: mockDbRow.id, farmId },
      });
    });

    it("should return false when count === 0", async () => {
      (prisma.animalWeightLog.deleteMany as jest.Mock).mockResolvedValueOnce({ count: 0 });

      const result = await repository.delete("non-existent", farmId);
      expect(result).toBe(false);
    });
  });
});
