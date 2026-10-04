import {
  FarmWithdrawalAlertsDto,
  FoodSafetyWithdrawalStatusDto,
  JwtPayload,
  WithdrawalAlertDispatchResultDto,
} from "@vetralink/shared-types";

export const FOOD_SAFETY_SERVICE = Symbol("FOOD_SAFETY_SERVICE");

export interface IFoodSafetyService {
  /**
   * Evaluates the food safety withdrawal status for a specific consultation's prescription.
   */
  getConsultationWithdrawalStatus(
    consultationId: string,
    user: JwtPayload,
  ): Promise<FoodSafetyWithdrawalStatusDto>;

  /**
   * Evaluates the comprehensive food safety withdrawal status for an animal across all its prescriptions.
   */
  getAnimalWithdrawalStatus(
    animalId: string,
    user: JwtPayload,
  ): Promise<FoodSafetyWithdrawalStatusDto>;

  /**
   * Retrieves all active food safety withdrawal alerts across an entire farm (herd bulk tank and slaughter protection).
   */
  getFarmWithdrawalAlerts(
    farmId: string,
    user: JwtPayload,
  ): Promise<FarmWithdrawalAlertsDto>;

  /**
   * Dispatches automated food safety warning notifications (push/SMS/email) to farm managers.
   */
  dispatchWithdrawalAlert(
    consultationId: string,
    author: JwtPayload,
    traceId?: string,
  ): Promise<WithdrawalAlertDispatchResultDto>;
}
