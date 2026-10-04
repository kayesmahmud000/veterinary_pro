import { UserRole, UserStatus } from "@vetralink/shared-types";
import { IVetAssignmentService } from "../services/vet-assignment.service.interface";
import { VetAvailabilityController } from "./vet-availability.controller";

describe("VetAvailabilityController", () => {
  let controller: VetAvailabilityController;
  let mockVetAssignmentService: jest.Mocked<IVetAssignmentService>;

  const mockUser = {
    sub: "user-vet-1",
    email: "vet@vetralink.com",
    role: UserRole.VET,
    status: UserStatus.ACTIVE,
  };

  const mockProfile = {
    id: "vp-123",
    userId: "user-vet-1",
    specialties: ["COW", "BUFFALO"],
    isAvailable: true,
    maxActiveCases: 5,
    workingHours: [{ dayOfWeek: 1, startTime: "08:00", endTime: "17:00" }],
    timezone: "UTC",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    user: {
      id: "user-vet-1",
      name: "Dr. Alice",
      email: "alice@vet.com",
      avatarUrl: null,
    },
  };

  beforeEach(() => {
    mockVetAssignmentService = {
      getRankedCandidates: jest.fn(),
      assignToVet: jest.fn(),
      autoAssign: jest.fn(),
      getVetAvailabilityList: jest.fn(),
      getVetProfile: jest.fn(),
      updateVetProfile: jest.fn(),
    };

    controller = new VetAvailabilityController(mockVetAssignmentService);
  });

  describe("getAvailabilityList()", () => {
    it("should return clinic availability overview", async () => {
      const mockList = [
        {
          vetId: "user-vet-1",
          name: "Dr. Alice",
          email: "alice@vet.com",
          avatarUrl: null,
          isAvailable: true,
          specialties: ["COW"],
          currentActiveCases: 2,
          maxActiveCases: 5,
          capacityUtilizationPercent: 40,
          timezone: "UTC",
        },
      ];

      mockVetAssignmentService.getVetAvailabilityList.mockResolvedValue(mockList);

      const result = await controller.getAvailabilityList();

      expect(mockVetAssignmentService.getVetAvailabilityList).toHaveBeenCalled();
      expect(result).toEqual(mockList);
    });
  });

  describe("getVetProfile()", () => {
    it("should return veterinarian profile by id", async () => {
      mockVetAssignmentService.getVetProfile.mockResolvedValue(mockProfile);

      const result = await controller.getVetProfile("user-vet-1");

      expect(mockVetAssignmentService.getVetProfile).toHaveBeenCalledWith("user-vet-1");
      expect(result.userId).toBe("user-vet-1");
      expect(result.specialties).toEqual(["COW", "BUFFALO"]);
    });
  });

  describe("updateVetProfile()", () => {
    it("should update veterinarian profile and return updated DTO", async () => {
      const updatedProfile = {
        ...mockProfile,
        isAvailable: false,
      };

      mockVetAssignmentService.updateVetProfile.mockResolvedValue(updatedProfile);

      const result = await controller.updateVetProfile(
        "user-vet-1",
        { isAvailable: false },
        mockUser,
      );

      expect(mockVetAssignmentService.updateVetProfile).toHaveBeenCalledWith(
        "user-vet-1",
        { isAvailable: false },
        "user-vet-1",
        UserRole.VET,
        "user-user-vet-1",
      );
      expect(result.isAvailable).toBe(false);
    });
  });
});
