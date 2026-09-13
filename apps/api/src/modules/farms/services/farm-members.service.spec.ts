import { Test, TestingModule } from "@nestjs/testing";
import { FarmRole } from "@vetralink/shared-types";
import { EntityConflictException } from "../../../common/exceptions/domain.exception";
import { FarmMemberEntity } from "../entities/farm-member.entity";
import {
  FARM_MEMBER_REPOSITORY,
  IFarmMemberRepository,
} from "../repositories/farm-member.repository.interface";
import { FarmMembersService } from "./farm-members.service";

describe("FarmMembersService", () => {
  let service: FarmMembersService;
  let memberRepo: jest.Mocked<IFarmMemberRepository>;

  const mockMember = FarmMemberEntity.create({
    id: "mem-1",
    farmId: "farm-1",
    userId: "user-1",
    role: FarmRole.HERDSMAN,
  });

  beforeEach(async () => {
    memberRepo = {
      findMembership: jest.fn(),
      findUserFarms: jest.fn(),
      findByFarmId: jest.fn(),
      countMembers: jest.fn(),
      create: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FarmMembersService,
        { provide: FARM_MEMBER_REPOSITORY, useValue: memberRepo },
      ],
    }).compile();

    service = module.get<FarmMembersService>(FarmMembersService);
  });

  describe("addMember()", () => {
    it("should throw EntityConflictException if user is already a member", async () => {
      memberRepo.findMembership.mockResolvedValue(mockMember);

      await expect(
        service.addMember("farm-1", { userId: "user-1" }),
      ).rejects.toThrow(EntityConflictException);
      expect(memberRepo.create).not.toHaveBeenCalled();
    });

    it("should create and return member when user is not a member", async () => {
      memberRepo.findMembership.mockResolvedValue(null);
      memberRepo.create.mockResolvedValue(mockMember);

      const result = await service.addMember("farm-1", {
        userId: "user-1",
        role: FarmRole.HERDSMAN,
      });

      expect(memberRepo.findMembership).toHaveBeenCalledWith(
        "farm-1",
        "user-1",
      );
      expect(memberRepo.create).toHaveBeenCalled();
      expect(result).toMatchObject({
        id: "mem-1",
        farmId: "farm-1",
        userId: "user-1",
        role: FarmRole.HERDSMAN,
      });
    });
  });

  describe("getMembers()", () => {
    it("should return list of farm members and total count", async () => {
      memberRepo.findByFarmId.mockResolvedValue([mockMember]);

      const result = await service.getMembers("farm-1");

      expect(memberRepo.findByFarmId).toHaveBeenCalledWith("farm-1");
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.items[0]?.id).toBe(mockMember.id);
    });
  });
});
