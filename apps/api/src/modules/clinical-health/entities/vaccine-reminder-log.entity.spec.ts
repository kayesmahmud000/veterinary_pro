import {
  ReminderChannel,
  ReminderMilestone,
  ReminderStatus,
} from "@vetralink/shared-types";
import { VaccineReminderLogEntity } from "./vaccine-reminder-log.entity";

describe("VaccineReminderLogEntity", () => {
  const farmId = "11111111-1111-1111-1111-111111111111";
  const vaccineRecordId = "22222222-2222-2222-2222-222222222222";
  const animalId = "33333333-3333-3333-3333-333333333333";
  const recipientUserId = "44444444-4444-4444-4444-444444444444";

  it("should create a valid entity with defaults", () => {
    const entity = VaccineReminderLogEntity.create({
      farmId,
      vaccineRecordId,
      animalId,
      recipientUserId,
      recipientPhone: "+1234567890",
      channel: ReminderChannel.SMS,
      milestone: ReminderMilestone.SEVEN_DAYS,
      status: ReminderStatus.SENT,
      message: "Reminder: Cow COW-042 due for FMD vaccine in 7 days",
      errorMessage: null,
      dispatchedDate: "2026-09-13",
    });

    expect(entity.id).toBeDefined();
    expect(entity.farmId).toBe(farmId);
    expect(entity.channel).toBe(ReminderChannel.SMS);
    expect(entity.milestone).toBe(ReminderMilestone.SEVEN_DAYS);
    expect(entity.status).toBe(ReminderStatus.SENT);
    expect(entity.dispatchedDate).toBe("2026-09-13");
    expect(entity.dispatchedAt).toBeInstanceOf(Date);
  });

  it("should reconstitute an entity from raw props", () => {
    const fixedDate = new Date("2026-09-13T08:00:00.000Z");
    const entity = VaccineReminderLogEntity.reconstitute({
      id: "log-123",
      farmId,
      vaccineRecordId,
      animalId,
      recipientUserId,
      recipientPhone: "+1234567890",
      channel: ReminderChannel.PUSH,
      milestone: ReminderMilestone.DUE_TODAY,
      status: ReminderStatus.SENT,
      message: "Due today: Anthrax booster",
      errorMessage: null,
      dispatchedDate: "2026-09-13",
      dispatchedAt: fixedDate,
    });

    expect(entity.id).toBe("log-123");
    expect(entity.channel).toBe(ReminderChannel.PUSH);
    expect(entity.dispatchedAt).toEqual(fixedDate);
  });

  it("should mark as failed with error message", () => {
    const entity = VaccineReminderLogEntity.create({
      farmId,
      vaccineRecordId,
      animalId,
      recipientUserId: null,
      recipientPhone: "+1234567890",
      channel: ReminderChannel.SMS,
      milestone: ReminderMilestone.OVERDUE,
      status: ReminderStatus.PENDING,
      message: "Overdue alert",
      errorMessage: null,
      dispatchedDate: "2026-09-13",
    });

    entity.markFailed("Gateway timeout 504");
    expect(entity.status).toBe(ReminderStatus.FAILED);
    expect(entity.errorMessage).toBe("Gateway timeout 504");
  });

  it("should convert correctly to response DTO", () => {
    const entity = VaccineReminderLogEntity.create({
      id: "log-456",
      farmId,
      vaccineRecordId,
      animalId,
      recipientUserId,
      recipientPhone: "+1234567890",
      channel: ReminderChannel.SMS,
      milestone: ReminderMilestone.THREE_DAYS,
      status: ReminderStatus.SENT,
      message: "Booster due in 3 days",
      errorMessage: null,
      dispatchedDate: "2026-09-13",
    });

    const dto = entity.toResponseDto();
    expect(dto.id).toBe("log-456");
    expect(dto.farmId).toBe(farmId);
    expect(dto.channel).toBe(ReminderChannel.SMS);
    expect(dto.dispatchedDate).toBe("2026-09-13");
    expect(typeof dto.dispatchedAt).toBe("string");
  });
});
