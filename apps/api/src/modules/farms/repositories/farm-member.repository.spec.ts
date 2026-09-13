import { Test, TestingModule } from "@nestjs/testing";
import { Prisma } from "@prisma/client";
import { FarmRole } from "@vetralink/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { FarmMemberRepository } from "./farm-member.repository";
import { FarmMemberEntity } from "../entities/farm-member.entity";
import { EntityConflictException } from "../../../common/exceptions/domain.exception";

describe("FarmMemberRepository", () => {
  let repository: FarmMemberRepository;
  let prisma: jest.Mocked<PrismaService>;

  const mockDbMember = {
    id: "m1111111-1111-1111-1111-111111111111",
    farmId: "f1111111-1111-1111-1111-111111111111",
    userId: "u1111111-1111-1111-1111-111111111111",
    role: "OWNER" as const,
    createdAt: new Date("2026-09-01T10:00:00Z"),
  };

  beforeEach(async () => {
    const mockPrismaService = {
      farmMember: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FarmMemberRepository,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    repository = module.get<FarmMemberRepository>(FarmMemberRepository);
    prisma = module.get(PrismaService);
  });

  describe("findMembership()", () => {
    it("should return FarmMemberEntity when active membership exists", async () => {
      (prisma.farmMember.findFirst as jest.Mock).mockResolvedValue(mockDbMember);

      const result = await repository.findMembership(
        mockDbMember.farmId,
        mockDbMember.userId
      );

      expect(prisma.farmMember.findFirst).toHaveBeenCalledWith({
        where: {
          farmId: mockDbMember.farmId,
          userId: mockDbMember.userId,
          farm: { deletedAt: null },
        },
      });
      expect(result).toBeInstanceOf(FarmMemberEntity);
      expect(result?.role).toBe(FarmRole.OWNER);
    });

    it("should return null when membership does not exist or farm is soft-deleted", async () => {
      (prisma.farmMember.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await repository.findMembership("farm-id", "user-id");
      expect(result).toBeNull();
    });
  });

  describe("findUserFarms()", () => {
    it("should return all active farm memberships for a user", async () => {
      (prisma.farmMember.findMany as jest.Mock).mockResolvedValue([mockDbMember]);

      const results = await repository.findUserFarms(mockDbMember.userId);

      expect(prisma.farmMember.findMany).toHaveBeenCalledWith({
        where: {
          userId: mockDbMember.userId,
          farm: { deletedAt: null },
        },
        orderBy: { createdAt: "desc" },
      });
      expect(results).toHaveLength(1);
      expect(results[0]?.farmId).toBe(mockDbMember.farmId);
    });
  });

  describe("findByFarmId()", () => {
    it("should return all members belonging to farm", async () => {
      (prisma.farmMember.findMany as jest.Mock).mockResolvedValue([mockDbMember]);

      const results = await repository.findByFarmId(mockDbMember.farmId);

      expect(prisma.farmMember.findMany).toHaveBeenCalledWith({
        where: {
          farmId: mockDbMember.farmId,
          farm: { deletedAt: null },
        },
        orderBy: { createdAt: "asc" },
      });
      expect(results).toHaveLength(1);
      expect(results[0]?.id).toBe(mockDbMember.id);
    });
  });

  describe("countMembers()", () => {
    it("should return member count for farm", async () => {
      (prisma.farmMember.count as jest.Mock).mockResolvedValue(2);

      const count = await repository.countMembers(mockDbMember.farmId);

      expect(prisma.farmMember.count).toHaveBeenCalledWith({
        where: {
          farmId: mockDbMember.farmId,
          farm: { deletedAt: null },
        },
      });
      expect(count).toBe(2);
    });
  });

  describe("create()", () => {
    it("should persist member and return entity", async () => {
      const entity = FarmMemberEntity.create({
        farmId: mockDbMember.farmId,
        userId: mockDbMember.userId,
        role: FarmRole.OWNER,
      });

      (prisma.farmMember.create as jest.Mock).mockResolvedValue(mockDbMember);

      const result = await repository.create(entity);

      expect(prisma.farmMember.create).toHaveBeenCalledWith({
        data: {
          id: entity.id,
          farmId: entity.farmId,
          userId: entity.userId,
          role: entity.role,
          createdAt: entity.createdAt,
        },
      });
      expect(result.id).toBe(mockDbMember.id);
    });

    it("should throw EntityConflictException on P2002 duplicate membership", async () => {
      const entity = FarmMemberEntity.create({
        farmId: mockDbMember.farmId,
        userId: mockDbMember.userId,
      });

      const error = new Prisma.PrismaClientKnownRequestError("Conflict", {
        code: "P2002",
        clientVersion: "5.19.1",
      });
      (prisma.farmMember.create as jest.Mock).mockRejectedValue(error);

      await expect(repository.create(entity)).rejects.toThrow(
        EntityConflictException
      );
    });
  });
});
