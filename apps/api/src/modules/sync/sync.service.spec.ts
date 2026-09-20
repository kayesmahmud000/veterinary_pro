import { Test, TestingModule } from "@nestjs/testing";
import {
  AnimalGender,
  AnimalSpecies,
  AnimalStatus,
  FarmRole,
  JwtPayload,
  SyncAnimalDto,
  SyncPullChangesMap,
  SyncPushRequestDto,
  UserRole,
} from "@vetralink/shared-types";
import {
  ForbiddenOperationException,
  ValidationDomainException,
} from "../../common/exceptions/domain.exception";
import {
  AUDIT_LOG_REPOSITORY,
  IAuditLogRepository,
} from "../audit/repositories/audit-log.repository.interface";
import {
  FARM_MEMBER_REPOSITORY,
  IFarmMemberRepository,
} from "../farms/repositories/farm-member.repository.interface";
import { FarmMemberEntity } from "../farms/entities/farm-member.entity";
import {
  ISyncRepository,
  SYNC_REPOSITORY,
} from "./repositories/sync.repository.interface";
import { SyncService } from "./services/sync.service";

describe("SyncService", () => {
  let service: SyncService;
  let syncRepo: jest.Mocked<ISyncRepository>;
  let farmMemberRepo: jest.Mocked<IFarmMemberRepository>;
  let auditLogRepo: jest.Mocked<IAuditLogRepository>;

  const mockFarmer: JwtPayload = {
    sub: "farmer-uuid-1",
    email: "farmer@vetralink.pro",
    role: UserRole.FARMER,
    status: "ACTIVE" as any,
  };

  const mockSuperAdmin: JwtPayload = {
    sub: "super-uuid-1",
    email: "admin@vetralink.pro",
    role: UserRole.SUPER_ADMIN,
    status: "ACTIVE" as any,
  };

  const mockFarmId = "farm-uuid-101";

  const emptyChanges: SyncPullChangesMap = {
    animals: { created: [], updated: [], deleted: [] },
    milkLogs: { created: [], updated: [], deleted: [] },
    healthRecords: { created: [], updated: [], deleted: [] },
    vaccineRecords: { created: [], updated: [], deleted: [] },
    weightLogs: { created: [], updated: [], deleted: [] },
    transactions: { created: [], updated: [], deleted: [] },
  };

  beforeEach(async () => {
    syncRepo = {
      pullFarmDeltas: jest.fn(),
      applyPushMutations: jest.fn(),
      getFarmSyncSummary: jest.fn(),
    };

    farmMemberRepo = {
      findMembership: jest.fn(),
      findUserFarms: jest.fn(),
      findByFarmId: jest.fn(),
      countMembers: jest.fn(),
      create: jest.fn(),
    };

    auditLogRepo = {
      record: jest.fn().mockResolvedValue({} as any),
      findByEntity: jest.fn(),
      findByTraceId: jest.fn(),
      query: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SyncService,
        { provide: SYNC_REPOSITORY, useValue: syncRepo },
        { provide: FARM_MEMBER_REPOSITORY, useValue: farmMemberRepo },
        { provide: AUDIT_LOG_REPOSITORY, useValue: auditLogRepo },
      ],
    }).compile();

    service = module.get<SyncService>(SyncService);
  });

  describe("pull", () => {
    it("should allow farmer with valid membership to pull delta changes", async () => {
      farmMemberRepo.findMembership.mockResolvedValue(
        FarmMemberEntity.reconstitute({
          id: "member-1",
          farmId: mockFarmId,
          userId: mockFarmer.sub,
          role: FarmRole.OWNER,
          createdAt: new Date(),
        })
      );

      const mockAnimal: SyncAnimalDto = {
        id: "animal-1",
        farmId: mockFarmId,
        tagNumber: "TAG-001",
        species: AnimalSpecies.COW,
        gender: AnimalGender.FEMALE,
        status: AnimalStatus.ACTIVE,
        syncVersion: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      syncRepo.pullFarmDeltas.mockResolvedValue({
        ...emptyChanges,
        animals: {
          created: [mockAnimal],
          updated: [],
          deleted: [],
        },
      });

      const response = await service.pull(mockFarmer, mockFarmId, 1726000000000);

      expect(response.farmId).toBe(mockFarmId);
      expect(response.changes.animals.created).toHaveLength(1);
      expect(response.changes.animals.created[0]?.tagNumber).toBe("TAG-001");
      expect(response.serverTimestamp).toBeDefined();
      expect(syncRepo.pullFarmDeltas).toHaveBeenCalledWith(
        mockFarmId,
        new Date(1726000000000)
      );
    });

    it("should perform initial full sync when lastPulledAt is null", async () => {
      farmMemberRepo.findMembership.mockResolvedValue(
        FarmMemberEntity.reconstitute({
          id: "member-1",
          farmId: mockFarmId,
          userId: mockFarmer.sub,
          role: FarmRole.OWNER,
          createdAt: new Date(),
        })
      );

      syncRepo.pullFarmDeltas.mockResolvedValue(emptyChanges);

      const response = await service.pull(mockFarmer, mockFarmId, null);

      expect(response.farmId).toBe(mockFarmId);
      expect(syncRepo.pullFarmDeltas).toHaveBeenCalledWith(mockFarmId, null);
    });

    it("should reject pull if user is not a member of the farm tenant", async () => {
      farmMemberRepo.findMembership.mockResolvedValue(null);

      await expect(
        service.pull(mockFarmer, mockFarmId, 1726000000000)
      ).rejects.toThrow(ForbiddenOperationException);
    });

    it("should allow SUPER_ADMIN to pull without explicit farm membership", async () => {
      syncRepo.pullFarmDeltas.mockResolvedValue(emptyChanges);

      const response = await service.pull(mockSuperAdmin, mockFarmId, null);

      expect(response.farmId).toBe(mockFarmId);
      expect(farmMemberRepo.findMembership).not.toHaveBeenCalled();
      expect(syncRepo.pullFarmDeltas).toHaveBeenCalledWith(mockFarmId, null);
    });

    it("should throw ValidationDomainException if lastPulledAt is invalid date string", async () => {
      farmMemberRepo.findMembership.mockResolvedValue(
        FarmMemberEntity.reconstitute({
          id: "member-1",
          farmId: mockFarmId,
          userId: mockFarmer.sub,
          role: FarmRole.OWNER,
          createdAt: new Date(),
        })
      );

      await expect(
        service.pull(mockFarmer, mockFarmId, "invalid-date-format")
      ).rejects.toThrow(ValidationDomainException);
    });
  });

  describe("push", () => {
    const pushDto: SyncPushRequestDto = {
      farmId: mockFarmId,
      lastPulledAt: 1726000000000,
      changes: {
        animals: {
          created: [
            {
              id: "animal-new-1",
              farmId: mockFarmId,
              tagNumber: "TAG-999",
              species: AnimalSpecies.COW,
              gender: AnimalGender.FEMALE,
              status: AnimalStatus.ACTIVE,
              syncVersion: 1,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
          updated: [],
          deleted: [],
        },
      },
    };

    it("should successfully apply push mutations and emit audit log", async () => {
      farmMemberRepo.findMembership.mockResolvedValue(
        FarmMemberEntity.reconstitute({
          id: "member-1",
          farmId: mockFarmId,
          userId: mockFarmer.sub,
          role: FarmRole.HERDSMAN,
          createdAt: new Date(),
        })
      );

      syncRepo.applyPushMutations.mockResolvedValue({
        appliedCounts: {
          animals: 1,
          milkLogs: 0,
          healthRecords: 0,
          vaccineRecords: 0,
          weightLogs: 0,
          transactions: 0,
        },
        conflicts: [],
      });

      const response = await service.push(mockFarmer, pushDto, "trace-123");

      expect(response.success).toBe(true);
      expect(response.appliedCounts.animals).toBe(1);
      expect(response.conflicts).toHaveLength(0);
      expect(syncRepo.applyPushMutations).toHaveBeenCalledWith(
        mockFarmId,
        mockFarmer.sub,
        pushDto.changes,
        new Date(pushDto.lastPulledAt)
      );
      expect(auditLogRepo.record).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockFarmer.sub,
          action: "OFFLINE_SYNC_PUSHED",
          entityType: "Farm",
          entityId: mockFarmId,
          traceId: "trace-123",
        })
      );
    });

    it("should handle conflicts and return conflict reports", async () => {
      farmMemberRepo.findMembership.mockResolvedValue(
        FarmMemberEntity.reconstitute({
          id: "member-1",
          farmId: mockFarmId,
          userId: mockFarmer.sub,
          role: FarmRole.HERDSMAN,
          createdAt: new Date(),
        })
      );

      syncRepo.applyPushMutations.mockResolvedValue({
        appliedCounts: {
          animals: 0,
          milkLogs: 0,
          healthRecords: 0,
          vaccineRecords: 0,
          weightLogs: 0,
          transactions: 0,
        },
        conflicts: [
          {
            table: "animals",
            recordId: "animal-new-1",
            reason: "Server version is newer than client edit watermark",
            resolution: "SERVER_WINS",
            serverVersion: 3,
            clientVersion: 1,
          },
        ],
      });

      const response = await service.push(mockFarmer, pushDto);

      expect(response.success).toBe(true);
      expect(response.conflicts).toHaveLength(1);
      expect(response.conflicts[0]?.resolution).toBe("SERVER_WINS");
    });

    it("should reject push if user is not a member of the farm", async () => {
      farmMemberRepo.findMembership.mockResolvedValue(null);

      await expect(service.push(mockFarmer, pushDto)).rejects.toThrow(
        ForbiddenOperationException
      );
    });
  });

  describe("getStatus", () => {
    it("should return farm sync summary entity counts", async () => {
      farmMemberRepo.findMembership.mockResolvedValue(
        FarmMemberEntity.reconstitute({
          id: "member-1",
          farmId: mockFarmId,
          userId: mockFarmer.sub,
          role: FarmRole.OWNER,
          createdAt: new Date(),
        })
      );

      syncRepo.getFarmSyncSummary.mockResolvedValue({
        animals: 42,
        milkLogs: 350,
        healthRecords: 12,
        vaccineRecords: 80,
        weightLogs: 95,
        transactions: 130,
      });

      const status = await service.getStatus(mockFarmer, mockFarmId);

      expect(status.farmId).toBe(mockFarmId);
      expect(status.entityCounts.animals).toBe(42);
      expect(status.entityCounts.milkLogs).toBe(350);
      expect(status.serverTimestamp).toBeDefined();
    });
  });
});
