import { Test, TestingModule } from "@nestjs/testing";
import { PrismaService } from "../../prisma/prisma.service";
import { SubscriptionUsageRepository } from "./subscription-usage.repository";

describe("SubscriptionUsageRepository", () => {
  let repository: SubscriptionUsageRepository;
  let prisma: {
    animal: {
      count: jest.Mock;
    };
    farmMember: {
      count: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      animal: {
        count: jest.fn(),
      },
      farmMember: {
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionUsageRepository,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    repository = module.get<SubscriptionUsageRepository>(
      SubscriptionUsageRepository,
    );
  });

  describe("countActiveAnimals", () => {
    it("should count non-deleted animals for the farm", async () => {
      prisma.animal.count.mockResolvedValue(12);

      const count = await repository.countActiveAnimals("farm-1");

      expect(count).toBe(12);
      expect(prisma.animal.count).toHaveBeenCalledWith({
        where: {
          farmId: "farm-1",
          deletedAt: null,
        },
      });
    });

    it("should support transaction client override", async () => {
      const txMock = {
        animal: {
          count: jest.fn().mockResolvedValue(5),
        },
      };

      const count = await repository.countActiveAnimals(
        "farm-1",
        txMock as any,
      );

      expect(count).toBe(5);
      expect(txMock.animal.count).toHaveBeenCalledWith({
        where: {
          farmId: "farm-1",
          deletedAt: null,
        },
      });
      expect(prisma.animal.count).not.toHaveBeenCalled();
    });
  });

  describe("countFarmMembers", () => {
    it("should count farm members for the farm", async () => {
      prisma.farmMember.count.mockResolvedValue(3);

      const count = await repository.countFarmMembers("farm-2");

      expect(count).toBe(3);
      expect(prisma.farmMember.count).toHaveBeenCalledWith({
        where: {
          farmId: "farm-2",
        },
      });
    });

    it("should support transaction client override", async () => {
      const txMock = {
        farmMember: {
          count: jest.fn().mockResolvedValue(1),
        },
      };

      const count = await repository.countFarmMembers(
        "farm-2",
        txMock as any,
      );

      expect(count).toBe(1);
      expect(txMock.farmMember.count).toHaveBeenCalledWith({
        where: {
          farmId: "farm-2",
        },
      });
      expect(prisma.farmMember.count).not.toHaveBeenCalled();
    });
  });
});
