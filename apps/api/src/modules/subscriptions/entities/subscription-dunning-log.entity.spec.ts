import {
  DunningChannel,
  DunningStage,
  DunningStatus,
  SubscriptionStatus,
} from "@vetralink/shared-types";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";
import { SubscriptionDunningLogEntity } from "./subscription-dunning-log.entity";
import { SubscriptionEntity } from "./subscription.entity";

describe("SubscriptionDunningLogEntity", () => {
  const validProps = {
    subscriptionId: "sub-123",
    userId: "user-456",
    farmId: "farm-789",
    stage: DunningStage.DAY_1,
    recipientEmail: "farmer@vetralink.pro",
    subject: "Payment Failed Notice",
    message: "Your recurring subscription payment failed.",
    gatewayInvoiceId: "in_12345",
  };

  it("should create a valid SubscriptionDunningLogEntity", () => {
    const log = SubscriptionDunningLogEntity.create(validProps);

    expect(log.id).toBeDefined();
    expect(log.subscriptionId).toBe("sub-123");
    expect(log.userId).toBe("user-456");
    expect(log.farmId).toBe("farm-789");
    expect(log.stage).toBe(DunningStage.DAY_1);
    expect(log.channel).toBe(DunningChannel.EMAIL);
    expect(log.status).toBe(DunningStatus.SENT);
    expect(log.recipientEmail).toBe("farmer@vetralink.pro");
    expect(log.subject).toBe("Payment Failed Notice");
    expect(log.gatewayInvoiceId).toBe("in_12345");
    expect(log.attemptCount).toBe(1);
    expect(log.dispatchedDate).toBe(new Date().toISOString().slice(0, 10));
  });

  it("should throw ValidationDomainException when subscriptionId is missing", () => {
    expect(() =>
      SubscriptionDunningLogEntity.create({ ...validProps, subscriptionId: "" }),
    ).toThrow(ValidationDomainException);
  });

  it("should throw ValidationDomainException when userId is missing", () => {
    expect(() =>
      SubscriptionDunningLogEntity.create({ ...validProps, userId: "" }),
    ).toThrow(ValidationDomainException);
  });

  it("should throw ValidationDomainException when recipientEmail is invalid", () => {
    expect(() =>
      SubscriptionDunningLogEntity.create({
        ...validProps,
        recipientEmail: "invalid-email",
      }),
    ).toThrow(ValidationDomainException);
  });

  it("should update status via markSent and markFailed", () => {
    const log = SubscriptionDunningLogEntity.create(validProps);

    log.markFailed("SMTP Connection Timeout");
    expect(log.status).toBe(DunningStatus.FAILED);
    expect(log.errorMessage).toBe("SMTP Connection Timeout");

    log.markSent();
    expect(log.status).toBe(DunningStatus.SENT);
    expect(log.errorMessage).toBeNull();
  });

  it("should convert to DTO correctly", () => {
    const log = SubscriptionDunningLogEntity.create(validProps);
    const dto = log.toDto();

    expect(dto.id).toBe(log.id);
    expect(dto.subscriptionId).toBe("sub-123");
    expect(dto.userId).toBe("user-456");
    expect(dto.stage).toBe(DunningStage.DAY_1);
    expect(dto.channel).toBe(DunningChannel.EMAIL);
    expect(dto.status).toBe(DunningStatus.SENT);
    expect(dto.dispatchedDate).toBe(log.dispatchedDate);
  });
});

describe("SubscriptionEntity - calculateDunningStage", () => {
  const now = new Date("2026-09-20T12:00:00Z");

  it("should return null if subscription is not PAST_DUE", () => {
    const sub = SubscriptionEntity.fromPersistence({
      id: "sub-1",
      userId: "user-1",
      farmId: "farm-1",
      planId: "plan-1",
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: new Date("2026-08-20T12:00:00Z"),
      currentPeriodEnd: new Date("2026-09-20T12:00:00Z"),
      gatewaySubId: "sub_1",
      cancelAtPeriodEnd: false,
      createdAt: new Date("2026-08-20T12:00:00Z"),
      updatedAt: new Date("2026-08-20T12:00:00Z"),
    });

    expect(sub.calculateDunningStage(now)).toBeNull();
  });

  it("should return DAY_1 when 0-2 days past due", () => {
    const sub = SubscriptionEntity.fromPersistence({
      id: "sub-1",
      userId: "user-1",
      farmId: "farm-1",
      planId: "plan-1",
      status: SubscriptionStatus.PAST_DUE,
      currentPeriodStart: new Date("2026-08-20T12:00:00Z"),
      currentPeriodEnd: new Date("2026-09-19T12:00:00Z"), // 1 day past due
      gatewaySubId: "sub_1",
      cancelAtPeriodEnd: false,
      createdAt: new Date("2026-08-20T12:00:00Z"),
      updatedAt: new Date("2026-09-19T12:00:00Z"),
    });

    expect(sub.calculateDunningStage(now)).toBe(DunningStage.DAY_1);
    expect(sub.daysPastDue(now)).toBe(1);
  });

  it("should return DAY_3 when 3-6 days past due", () => {
    const sub = SubscriptionEntity.fromPersistence({
      id: "sub-1",
      userId: "user-1",
      farmId: "farm-1",
      planId: "plan-1",
      status: SubscriptionStatus.PAST_DUE,
      currentPeriodStart: new Date("2026-08-20T12:00:00Z"),
      currentPeriodEnd: new Date("2026-09-17T12:00:00Z"), // 3 days past due
      gatewaySubId: "sub_1",
      cancelAtPeriodEnd: false,
      createdAt: new Date("2026-08-20T12:00:00Z"),
      updatedAt: new Date("2026-09-17T12:00:00Z"),
    });

    expect(sub.calculateDunningStage(now)).toBe(DunningStage.DAY_3);
    expect(sub.daysPastDue(now)).toBe(3);
  });

  it("should return DAY_7 when >= 7 days past due", () => {
    const sub = SubscriptionEntity.fromPersistence({
      id: "sub-1",
      userId: "user-1",
      farmId: "farm-1",
      planId: "plan-1",
      status: SubscriptionStatus.PAST_DUE,
      currentPeriodStart: new Date("2026-08-10T12:00:00Z"),
      currentPeriodEnd: new Date("2026-09-13T12:00:00Z"), // 7 days past due
      gatewaySubId: "sub_1",
      cancelAtPeriodEnd: false,
      createdAt: new Date("2026-08-10T12:00:00Z"),
      updatedAt: new Date("2026-09-13T12:00:00Z"),
    });

    expect(sub.calculateDunningStage(now)).toBe(DunningStage.DAY_7);
    expect(sub.daysPastDue(now)).toBe(7);
  });
});
