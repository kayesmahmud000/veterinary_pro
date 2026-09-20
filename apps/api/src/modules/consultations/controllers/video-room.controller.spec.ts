import {
  EndVideoRoomDto,
  JoinVideoRoomDto,
  JwtPayload,
  UserRole,
  UserStatus,
  VideoRoomDto,
} from "@vetralink/shared-types";
import { VideoRoomController } from "./video-room.controller";
import { IVideoRoomService } from "../services/video-room.service.interface";

describe("VideoRoomController", () => {
  let controller: VideoRoomController;
  let mockVideoRoomService: jest.Mocked<IVideoRoomService>;

  const mockVetUser: JwtPayload = {
    sub: "vet-123",
    email: "vet@clinic.com",
    role: UserRole.VET,
    status: UserStatus.ACTIVE,
  };

  const mockFarmerUser: JwtPayload = {
    sub: "farmer-123",
    email: "farmer@farm.com",
    role: UserRole.FARMER,
    status: UserStatus.ACTIVE,
  };

  beforeEach(() => {
    mockVideoRoomService = {
      provisionVideoRoom: jest.fn(),
      joinVideoRoom: jest.fn(),
      endVideoRoom: jest.fn(),
    };

    controller = new VideoRoomController(mockVideoRoomService);
  });

  describe("provisionVideoRoom", () => {
    it("should call videoRoomService.provisionVideoRoom with consultation ID and user", async () => {
      const mockResult: VideoRoomDto = {
        consultationId: "c-123",
        roomName: "vetralink-consult-c-123",
        roomUrl: "https://mock.daily.co/vetralink-consult-c-123",
        maxParticipants: 2,
        privacy: "private",
        createdAt: "2026-09-20T12:00:00.000Z",
        expiresAt: "2026-09-20T14:00:00.000Z",
      };
      mockVideoRoomService.provisionVideoRoom.mockResolvedValue(mockResult);

      const result = await controller.provisionVideoRoom("c-123", mockVetUser);

      expect(result).toEqual(mockResult);
      expect(mockVideoRoomService.provisionVideoRoom).toHaveBeenCalledWith(
        "c-123",
        mockVetUser,
        "user-vet-123",
      );
    });
  });

  describe("joinVideoRoom", () => {
    it("should call videoRoomService.joinVideoRoom and return meeting token details", async () => {
      const mockResult: JoinVideoRoomDto = {
        consultationId: "c-123",
        roomName: "vetralink-consult-c-123",
        roomUrl: "https://mock.daily.co/vetralink-consult-c-123",
        token: "ephemeral-token-abc",
        isOwner: true,
        userName: "Dr. Veterinarian",
        expiresAt: "2026-09-20T14:00:00.000Z",
      };
      mockVideoRoomService.joinVideoRoom.mockResolvedValue(mockResult);

      const result = await controller.joinVideoRoom("c-123", mockVetUser);

      expect(result).toEqual(mockResult);
      expect(mockVideoRoomService.joinVideoRoom).toHaveBeenCalledWith(
        "c-123",
        mockVetUser,
        "user-vet-123",
      );
    });
  });

  describe("endVideoRoom", () => {
    it("should call videoRoomService.endVideoRoom and return teardown summary", async () => {
      const mockResult: EndVideoRoomDto = {
        consultationId: "c-123",
        roomName: "vetralink-consult-c-123",
        endedAt: "2026-09-20T12:45:00.000Z",
      };
      mockVideoRoomService.endVideoRoom.mockResolvedValue(mockResult);

      const result = await controller.endVideoRoom("c-123", mockVetUser);

      expect(result).toEqual(mockResult);
      expect(mockVideoRoomService.endVideoRoom).toHaveBeenCalledWith(
        "c-123",
        mockVetUser,
        "user-vet-123",
      );
    });
  });
});
