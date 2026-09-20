import {
  ConsultationPaymentStatus,
  JwtPayload,
  UserRole,
  UserStatus,
} from "@vetralink/shared-types";
import { ConsultationPaymentController } from "./consultation-payment.controller";
import { IConsultationPaymentService } from "../services/consultation-payment.service.interface";

describe("ConsultationPaymentController", () => {
  let controller: ConsultationPaymentController;
  let mockPaymentService: jest.Mocked<IConsultationPaymentService>;

  const mockUser: JwtPayload = {
    sub: "user-123",
    email: "farmer@farm.com",
    role: UserRole.FARMER,
    status: UserStatus.ACTIVE,
  };

  beforeEach(() => {
    mockPaymentService = {
      createHold: jest.fn(),
      confirmHold: jest.fn(),
      capturePayment: jest.fn(),
      releaseHold: jest.fn(),
    };

    controller = new ConsultationPaymentController(mockPaymentService);
  });

  describe("createHold", () => {
    it("should call paymentService.createHold and return hold result", async () => {
      const mockResult = {
        consultationId: "c-123",
        paymentIntentId: "pi_123",
        clientSecret: "secret_123",
        amountCents: 3000,
        currency: "USD",
        paymentStatus: ConsultationPaymentStatus.AUTHORIZED,
      };
      mockPaymentService.createHold.mockResolvedValue(mockResult);

      const result = await controller.createHold("c-123", mockUser, "farm-123");

      expect(result).toEqual(mockResult);
      expect(mockPaymentService.createHold).toHaveBeenCalledWith(
        "c-123",
        "farm-123",
        "user-123",
      );
    });
  });

  describe("confirmHold", () => {
    it("should call paymentService.confirmHold and return confirmed hold", async () => {
      const mockResult = {
        consultationId: "c-123",
        paymentIntentId: "pi_123",
        amountCents: 3000,
        currency: "USD",
        paymentStatus: ConsultationPaymentStatus.AUTHORIZED,
      };
      mockPaymentService.confirmHold.mockResolvedValue(mockResult);

      const result = await controller.confirmHold(
        "c-123",
        { paymentIntentId: "pi_123" },
        mockUser,
      );

      expect(result).toEqual(mockResult);
      expect(mockPaymentService.confirmHold).toHaveBeenCalledWith(
        "c-123",
        "pi_123",
        "user-123",
      );
    });
  });

  describe("capturePayment", () => {
    it("should call paymentService.capturePayment and return capture result", async () => {
      const mockResult = {
        consultationId: "c-123",
        paymentIntentId: "pi_123",
        amountCents: 3000,
        paymentStatus: ConsultationPaymentStatus.CAPTURED,
        capturedAt: new Date().toISOString(),
      };
      mockPaymentService.capturePayment.mockResolvedValue(mockResult);

      const result = await controller.capturePayment("c-123", {
        ...mockUser,
        role: UserRole.VET,
      });

      expect(result).toEqual(mockResult);
      expect(mockPaymentService.capturePayment).toHaveBeenCalledWith(
        "c-123",
        "user-123",
      );
    });
  });

  describe("releaseHold", () => {
    it("should call paymentService.releaseHold and return release result", async () => {
      const mockResult = {
        consultationId: "c-123",
        paymentIntentId: "pi_123",
        paymentStatus: ConsultationPaymentStatus.RELEASED,
        releasedAt: new Date().toISOString(),
        reason: "Cancelled by triage",
      };
      mockPaymentService.releaseHold.mockResolvedValue(mockResult);

      const result = await controller.releaseHold(
        "c-123",
        { reason: "Cancelled by triage" },
        mockUser,
      );

      expect(result).toEqual(mockResult);
      expect(mockPaymentService.releaseHold).toHaveBeenCalledWith(
        "c-123",
        "Cancelled by triage",
        "user-123",
      );
    });
  });
});
