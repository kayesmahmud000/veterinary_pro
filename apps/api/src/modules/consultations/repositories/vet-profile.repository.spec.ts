import { PrismaService } from "../../prisma/prisma.service";
import { VetProfileEntity } from "../entities/vet-profile.entity";
import { VetProfileRepository } from "./vet-profile.repository";

describe("VetProfileRepository", () => {
  let repository: VetProfileRepository;
  let mockPrisma: any;

  const mockRecord = {
    id: "vp-123",
    userId: "user-vet-1",
    specialties: ["COW", "BUFFALO"],
    isAvailable: true,
    maxActiveCases: 5,
    workingHours: [{ dayOfWeek: 1, startTime: "08:00", endTime: "17:00" }],
    timezone: "UTC",
    createdAt: new Date("2026-09-01T00:00:00Z"),
    updatedAt: new Date("2026-09-01T00:00:00Z"),
    user: {
      id: "user-vet-1",
      name: "Dr. Smith",
      email: "smith@vet.com",
      avatarUrl: "https://example.com/avatar.jpg",
    },
  };

  beforeEach(() => {
    mockPrisma = {
      vetProfile: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      user: {
        findMany: jest.fn(),
      },
    };

    repository = new VetProfileRepository(mockPrisma as unknown as PrismaService);
  });

  describe("findByUserId()", () => {
    it("should return VetProfileEntity when found", async () => {
      mockPrisma.vetProfile.findUnique.mockResolvedValue(mockRecord);

      const result = await repository.findByUserId("user-vet-1");

      expect(mockPrisma.vetProfile.findUnique).toHaveBeenCalledWith({
        where: { userId: "user-vet-1" },
        include: expect.any(Object),
      });
      expect(result).not.toBeNull();
      expect(result?.userId).toBe("user-vet-1");
      expect(result?.specialties).toEqual(["COW", "BUFFALO"]);
    });

    it("should return null when not found", async () => {
      mockPrisma.vetProfile.findUnique.mockResolvedValue(null);

      const result = await repository.findByUserId("non-existent");
      expect(result).toBeNull();
    });
  });

  describe("save()", () => {
    it("should upsert vet profile and return entity", async () => {
      const entity = VetProfileEntity.fromPersistence(mockRecord);
      mockPrisma.vetProfile.upsert.mockResolvedValue(mockRecord);

      const result = await repository.save(entity);

      expect(mockPrisma.vetProfile.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "user-vet-1" },
        }),
      );
      expect(result.userId).toBe("user-vet-1");
    });
  });

  describe("findAllActiveVetsWithProfiles()", () => {
    it("should return active vets with their profiles", async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        {
          id: "user-vet-1",
          name: "Dr. Smith",
          email: "smith@vet.com",
          avatarUrl: null,
          role: "VET",
          status: "ACTIVE",
          vetProfile: mockRecord,
        },
      ]);

      const result = await repository.findAllActiveVetsWithProfiles();

      expect(result).toHaveLength(1);
      expect(result[0]?.user.name).toBe("Dr. Smith");
      expect(result[0]?.profile?.specialties).toEqual(["COW", "BUFFALO"]);
    });
  });
});
