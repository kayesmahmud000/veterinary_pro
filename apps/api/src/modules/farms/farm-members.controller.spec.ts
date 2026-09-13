import { FarmRole } from "@vetralink/shared-types";
import { FarmMembersController } from "./farm-members.controller";
import { IFarmMembersService } from "./services/farm-members.service.interface";

describe("FarmMembersController", () => {
  let controller: FarmMembersController;
  let mockService: jest.Mocked<IFarmMembersService>;

  beforeEach(() => {
    mockService = {
      addMember: jest.fn(),
      getMembers: jest.fn(),
    };

    controller = new FarmMembersController(mockService);
  });

  describe("addMember()", () => {
    it("should delegate to farmMembersService.addMember", async () => {
      const mockResult = {
        id: "mem-1",
        farmId: "farm-1",
        userId: "user-1",
        role: FarmRole.HERDSMAN,
        createdAt: "2026-09-13T00:00:00.000Z",
      };

      mockService.addMember.mockResolvedValue(mockResult);

      const dto = { userId: "user-1", role: FarmRole.HERDSMAN };
      const result = await controller.addMember("farm-1", dto);

      expect(mockService.addMember).toHaveBeenCalledWith("farm-1", dto);
      expect(result).toEqual(mockResult);
    });
  });

  describe("getMembers()", () => {
    it("should delegate to farmMembersService.getMembers", async () => {
      const mockList = {
        items: [
          {
            id: "mem-1",
            farmId: "farm-1",
            userId: "user-1",
            role: FarmRole.HERDSMAN,
            createdAt: "2026-09-13T00:00:00.000Z",
          },
        ],
        total: 1,
      };

      mockService.getMembers.mockResolvedValue(mockList);

      const result = await controller.getMembers("farm-1");

      expect(mockService.getMembers).toHaveBeenCalledWith("farm-1");
      expect(result).toEqual(mockList);
    });
  });
});
