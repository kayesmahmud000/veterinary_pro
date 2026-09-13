import {
  HealthEscalationAction,
  HealthEscalationLevel,
  ReminderChannel,
  ReminderStatus,
} from "@vetralink/shared-types";
import { HealthEscalationLogEntity } from "./health-escalation-log.entity";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";

describe("HealthEscalationLogEntity", () => {
  const farmId = "11111111-1111-1111-1111-111111111111";
  const healthRecordId = "22222222-2222-2222-2222-222222222222";
  const animalId = "33333333-3333-3333-3333-333333333333";
  const recipientUserId = "44444444-4444-4444-4444-444444444444";

  it("should create a valid escalation log entity with default id and date", () => {
    const entity = HealthEscalationLogEntity.create({
      farmId,
      healthRecordId,
      animalId,
      level: HealthEscalationLevel.LEVEL_1_STAFF_ALERT,
      actionTaken: HealthEscalationAction.NOTIFY_VET_HERDSMAN,
      recipientUserId,
      recipientPhone: "+1234567890",
      channel: ReminderChannel.SMS,
      status: ReminderStatus.SENT,
      notes: "Alerted vet for critical case",
      hoursUnresolved: 24,
    });

    expect(entity.id).toBeDefined();
    expect(entity.farmId).toBe(farmId);
    expect(entity.healthRecordId).toBe(healthRecordId);
    expect(entity.animalId).toBe(animalId);
    expect(entity.level).toBe(HealthEscalationLevel.LEVEL_1_STAFF_ALERT);
    expect(entity.actionTaken).toBe(HealthEscalationAction.NOTIFY_VET_HERDSMAN);
    expect(entity.recipientUserId).toBe(recipientUserId);
    expect(entity.recipientPhone).toBe("+1234567890");
    expect(entity.channel).toBe(ReminderChannel.SMS);
    expect(entity.status).toBe(ReminderStatus.SENT);
    expect(entity.hoursUnresolved).toBe(24);
    expect(entity.dispatchedAt).toBeInstanceOf(Date);
  });

  it("should reconstitute an entity from raw props", () => {
    const fixedDate = new Date("2026-09-13T09:00:00.000Z");
    const entity = HealthEscalationLogEntity.reconstitute({
      id: "esc-123",
      farmId,
      healthRecordId,
      animalId,
      level: HealthEscalationLevel.LEVEL_2_OWNER_ALERT,
      actionTaken: HealthEscalationAction.NOTIFY_FARM_OWNER,
      recipientUserId: null,
      recipientPhone: "+1987654321",
      channel: ReminderChannel.PUSH,
      status: ReminderStatus.SENT,
      notes: "Escalated to owner",
      hoursUnresolved: 48,
      dispatchedAt: fixedDate,
    });

    expect(entity.id).toBe("esc-123");
    expect(entity.level).toBe(HealthEscalationLevel.LEVEL_2_OWNER_ALERT);
    expect(entity.dispatchedAt).toEqual(fixedDate);
  });

  it("should mark as failed with notes", () => {
    const entity = HealthEscalationLogEntity.create({
      farmId,
      healthRecordId,
      animalId,
      level: HealthEscalationLevel.LEVEL_3_EMERGENCY_INTERVENTION,
      actionTaken: HealthEscalationAction.RECOMMEND_QUARANTINE,
      recipientUserId: null,
      recipientPhone: "+1234567890",
      channel: ReminderChannel.SMS,
      status: ReminderStatus.PENDING,
      notes: null,
      hoursUnresolved: 72,
    });

    entity.markFailed("SMS gateway error 500");
    expect(entity.status).toBe(ReminderStatus.FAILED);
    expect(entity.notes).toBe("SMS gateway error 500");
  });

  it("should convert to response DTO", () => {
    const entity = HealthEscalationLogEntity.create({
      id: "esc-456",
      farmId,
      healthRecordId,
      animalId,
      level: HealthEscalationLevel.LEVEL_1_STAFF_ALERT,
      actionTaken: HealthEscalationAction.NOTIFY_VET_HERDSMAN,
      recipientUserId,
      recipientPhone: "+1234567890",
      channel: ReminderChannel.SMS,
      status: ReminderStatus.SENT,
      notes: "Notified herdsman",
      hoursUnresolved: 24,
    });

    const dto = entity.toResponseDto();
    expect(dto.id).toBe("esc-456");
    expect(dto.farmId).toBe(farmId);
    expect(dto.level).toBe(HealthEscalationLevel.LEVEL_1_STAFF_ALERT);
    expect(dto.hoursUnresolved).toBe(24);
    expect(typeof dto.dispatchedAt).toBe("string");
  });

  it("should throw validation error if farmId is empty", () => {
    expect(() =>
      HealthEscalationLogEntity.create({
        farmId: "",
        healthRecordId,
        animalId,
        level: HealthEscalationLevel.LEVEL_1_STAFF_ALERT,
        actionTaken: HealthEscalationAction.NOTIFY_VET_HERDSMAN,
        recipientUserId: null,
        recipientPhone: null,
        channel: ReminderChannel.SMS,
        status: ReminderStatus.SENT,
        notes: null,
        hoursUnresolved: 24,
      })
    ).toThrow(ValidationDomainException);
  });

  it("should throw validation error if hoursUnresolved is negative", () => {
    expect(() =>
      HealthEscalationLogEntity.create({
        farmId,
        healthRecordId,
        animalId,
        level: HealthEscalationLevel.LEVEL_1_STAFF_ALERT,
        actionTaken: HealthEscalationAction.NOTIFY_VET_HERDSMAN,
        recipientUserId: null,
        recipientPhone: null,
        channel: ReminderChannel.SMS,
        status: ReminderStatus.SENT,
        notes: null,
        hoursUnresolved: -5,
      })
    ).toThrow(ValidationDomainException);
  });
});
