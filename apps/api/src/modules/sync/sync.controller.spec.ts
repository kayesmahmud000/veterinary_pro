import { Test, TestingModule } from "@nestjs/testing";
import {
  JwtPayload,
  SyncPullResponseDto,
  SyncPushResponseDto,
  SyncStatusDto,
  UserRole,
} from "@vetralink/shared-types";
import { SyncController } from "./controllers/sync.controller";
import {
  ISyncService,
  SYNC_SERVICE,
} from "./services/sync.service.interface";

describe("SyncController", () => {
  let controller: SyncController;
  let syncService: jest.Mocked<ISyncService>;

  const mockFarmer: JwtPayload = {
    sub: "farmer-uuid-1",
    email: "farmer@vetralink.pro",
    role: UserRole.FARMER,
    status: "ACTIVE" as any,
  };

  const mockFarmId = "farm-uuid-101";

  beforeEach(() => {
    syncService = {
      pull: jest.fn(),
      push: jest.fn(),
      getStatus: jest.fn(),
    };

    controller = new SyncController(syncService);
  });

  describe("pull", () => {
    it("should delegate to syncService.pull", async () => {
      const mockResponse: SyncPullResponseDto = {
        farmId: mockFarmId,
        serverTimestamp: 1726000000000,
        changes: {
          animals: { created: [], updated: [], deleted: [] },
          milkLogs: { created: [], updated: [], deleted: [] },
          healthRecords: { created: [], updated: [], deleted: [] },
          vaccineRecords: { created: [], updated: [], deleted: [] },
          weightLogs: { created: [], updated: [], deleted: [] },
          transactions: { created: [], updated: [], deleted: [] },
        },
      };

      syncService.pull.mockResolvedValue(mockResponse);

      const result = await controller.pull(mockFarmer, {
        farmId: mockFarmId,
        lastPulledAt: 1725900000000,
      });

      expect(result).toEqual(mockResponse);
      expect(syncService.pull).toHaveBeenCalledWith(
        mockFarmer,
        mockFarmId,
        1725900000000
      );
    });
  });

  describe("push", () => {
    it("should delegate to syncService.push", async () => {
      const mockResponse: SyncPushResponseDto = {
        success: true,
        serverTimestamp: 1726000000000,
        appliedCounts: {
          animals: 1,
          milkLogs: 2,
          healthRecords: 0,
          vaccineRecords: 0,
          weightLogs: 0,
          transactions: 0,
        },
        conflicts: [],
      };

      syncService.push.mockResolvedValue(mockResponse);

      const pushDto = {
        farmId: mockFarmId,
        lastPulledAt: 1725900000000,
        changes: {
          animals: { created: [], updated: [], deleted: [] },
        },
      };

      const result = await controller.push(mockFarmer, pushDto, "trace-abc");

      expect(result).toEqual(mockResponse);
      expect(syncService.push).toHaveBeenCalledWith(
        mockFarmer,
        pushDto,
        "trace-abc"
      );
    });
  });

  describe("getStatus", () => {
    it("should delegate to syncService.getStatus", async () => {
      const mockStatus: SyncStatusDto = {
        farmId: mockFarmId,
        serverTimestamp: 1726000000000,
        entityCounts: {
          animals: 10,
          milkLogs: 50,
          healthRecords: 2,
          vaccineRecords: 8,
          weightLogs: 12,
          transactions: 20,
        },
      };

      syncService.getStatus.mockResolvedValue(mockStatus);

      const result = await controller.getStatus(mockFarmer, mockFarmId);

      expect(result).toEqual(mockStatus);
      expect(syncService.getStatus).toHaveBeenCalledWith(
        mockFarmer,
        mockFarmId
      );
    });
  });
});
