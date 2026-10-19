import * as shared from "@vetralink/shared-types";

describe("Administrative consultation contracts", () => {
  it("exposes the six binding strict operational contracts", () => {
    for (const name of [
      "adminConsultationQuerySchema",
      "adminConsultationListSchema",
      "adminConsultationDetailSchema",
      "adminConsultationCandidatesSchema",
      "adminConsultationActionSchema",
    ]) {
      expect((shared as any)[name]).toBeDefined();
    }
  });
  it("bounds filters and rejects provider/clinical/unknown mutation fields", () => {
    const q = (shared as any).adminConsultationQuerySchema;
    const action = (shared as any).adminConsultationActionSchema;
    expect(q?.safeParse({ limit: 101 }).success).toBe(false);
    expect(q?.safeParse({ status: "COMPLETED", limit: "1" }).success).toBe(
      true,
    );
    expect(q?.safeParse({ vetId: "private" }).success).toBe(false);
    const input = {
      action: "CANCEL",
      expectedRevision: "a".repeat(64),
      reason: " Reviewed case ",
      actorPassword: "password",
    };
    expect(action?.parse(input).reason).toBe("Reviewed case");
    for (const extra of [
      { vetId: "550e8400-e29b-41d4-a716-446655440001" },
      { paymentStatus: "RELEASED" },
      { scheduledAt: "2026-10-17" },
    ]) {
      expect(action?.safeParse({ ...input, ...extra }).success).toBe(false);
    }
    expect(
      action?.safeParse({ ...input, actorPassword: "x".repeat(129) }).success,
    ).toBe(false);
    expect(action?.safeParse({ ...input, reason: "four" }).success).toBe(false);
    expect(action?.safeParse({ ...input, action: "ASSIGN" }).success).toBe(
      false,
    );
  });
});

import { AdminConsultationsService } from "./consultations.service";
import { AdminConsultationsController } from "./consultations.controller";
import {
  consultationAllowedActions,
  evaluateConsultationCandidate,
  projectConsultation,
} from "./consultations.repository";
import { JwtPayload, UserRole, UserStatus } from "@vetralink/shared-types";
import { UserEntity } from "../users/entities/user.entity";
import { ROLES_KEY } from "../../common/decorators/roles.decorator";
const id = "550e8400-e29b-41d4-a716-446655440001";
const vetId = "550e8400-e29b-41d4-a716-446655440002";
const claims = {
  sub: id,
  role: UserRole.ADMIN,
  authorizationVersion: 2,
} as JwtPayload;
const actor = (role = UserRole.ADMIN, version = 2, hash = "hash") =>
  UserEntity.reconstitute({
    id,
    role,
    status: UserStatus.ACTIVE,
    authorizationVersion: version,
    email: "synthetic@example.test",
    name: "Admin",
    passwordHash: hash,
    phone: null,
    phoneHash: null,
    avatarUrl: null,
    isEmailVerified: false,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  });
const input = {
  action: "ASSIGN" as const,
  vetId,
  expectedRevision: "a".repeat(64),
  reason: "Review assignment",
  actorPassword: "synthetic-password",
};
const profile = {
  specialties: ["CATTLE"],
  isAvailable: true,
  maxActiveCases: 1,
  workingHours: [{ dayOfWeek: 5, startTime: "09:00", endTime: "17:00" }],
  timezone: "Asia/Dhaka",
};
describe("Administrative consultation policy", () => {
  let service: AdminConsultationsService,
    repo: any,
    users: any,
    passwords: any,
    limiter: any,
    audit: any,
    transactions: any;
  const tx = { marker: "atomic" };
  beforeEach(() => {
    repo = {
      list: jest.fn(async () => ({ items: [], nextCursor: null })),
      detail: jest.fn(async () => ({
        id,
        revision: input.expectedRevision,
        allowedActions: ["ASSIGN", "AUTO_ASSIGN", "CANCEL"],
        status: "SUBMITTED",
        vet: null,
      })),
      lock: jest.fn(async () => null),
      lockVet: jest.fn(),
      candidate: jest.fn(async () => ({ vetId, isEligible: true })),
      candidates: jest.fn(async () => ({
        consultationId: id,
        items: [{ vetId, isEligible: true }],
        truncated: false,
      })),
      assign: jest.fn(),
      cancel: jest.fn(),
      notify: jest.fn(),
    };
    users = {
      findById: jest.fn(async () => actor()),
      lockById: jest.fn(async () => actor()),
    };
    passwords = { compare: jest.fn(async () => true) };
    limiter = { hit: jest.fn() };
    audit = { record: jest.fn() };
    transactions = { run: jest.fn(async (fn: any) => fn(tx)) };
    service = new AdminConsultationsService(
      repo,
      users,
      passwords,
      transactions,
      audit,
      limiter,
    );
  });
  it("uses exact ADMIN/SUPER_ADMIN guards", () => {
    expect(
      Reflect.getMetadata(ROLES_KEY, AdminConsultationsController),
    ).toEqual([UserRole.ADMIN, UserRole.SUPER_ADMIN]);
    expect(
      Reflect.getMetadata("__guards__", AdminConsultationsController).map(
        (g: any) => g.name,
      ),
    ).toEqual(["JwtAuthGuard", "RolesGuard"]);
  });
  for (const role of [
    UserRole.LEARNER,
    UserRole.FARMER,
    UserRole.BUYER,
    UserRole.VET,
  ])
    it(`denies current ${role}`, async () => {
      users.findById.mockResolvedValue(actor(role));
      await expect(service.list(claims, { limit: 20 })).rejects.toMatchObject({
        statusCode: 403,
      });
      await expect(service.action(claims, id, input)).rejects.toMatchObject({
        statusCode: 403,
      });
      expect(repo.assign).not.toHaveBeenCalled();
    });
  it("requires current role and authorization version including locked identity", async () => {
    users.findById.mockResolvedValue(actor(UserRole.ADMIN, 3));
    await expect(service.detail(claims, id)).rejects.toMatchObject({
      statusCode: 403,
    });
    users.findById.mockResolvedValue(actor());
    users.lockById.mockResolvedValue(actor(UserRole.ADMIN, 2, "changed"));
    await expect(service.action(claims, id, input)).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(repo.assign).not.toHaveBeenCalled();
  });
  it("confirms password and fails closed on limiter failure before any write", async () => {
    passwords.compare.mockResolvedValue(false);
    await expect(service.action(claims, id, input)).rejects.toMatchObject({
      errorCode: "PASSWORD_CONFIRMATION_FAILED",
    });
    expect(limiter.hit).toHaveBeenCalledWith(
      "admin-consultations",
      id,
      10,
      900,
    );
    passwords.compare.mockResolvedValue(true);
    limiter.hit.mockRejectedValue(new Error("offline"));
    await expect(service.action(claims, id, input)).rejects.toThrow("offline");
    expect(repo.lock).not.toHaveBeenCalled();
  });
  it("rejects stale revisions, unavailable transitions and ineligible vets before mutation", async () => {
    await expect(
      service.action(claims, id, {
        ...input,
        expectedRevision: "b".repeat(64),
      }),
    ).rejects.toMatchObject({ errorCode: "CONSULTATION_VERSION_CONFLICT" });
    repo.detail.mockResolvedValue({
      id,
      revision: input.expectedRevision,
      allowedActions: [],
    });
    await expect(service.action(claims, id, input)).rejects.toMatchObject({
      errorCode: "CONSULTATION_ACTION_UNAVAILABLE",
    });
    repo.detail.mockResolvedValue({
      id,
      revision: input.expectedRevision,
      allowedActions: ["ASSIGN"],
    });
    repo.candidate.mockResolvedValue({ vetId, isEligible: false });
    await expect(service.action(claims, id, input)).rejects.toMatchObject({
      errorCode: "CONSULTATION_ACTION_UNAVAILABLE",
    });
    expect(repo.assign).not.toHaveBeenCalled();
  });
  it("rechecks automatic candidate under lock and reports no candidates", async () => {
    repo.candidates.mockResolvedValue({
      consultationId: id,
      items: [],
      truncated: false,
    });
    const { vetId: unused, ...base } = input;
    await expect(
      service.action(claims, id, { ...base, action: "AUTO_ASSIGN" }),
    ).rejects.toMatchObject({ errorCode: "CONSULTATION_ACTION_UNAVAILABLE" });
    expect(repo.assign).not.toHaveBeenCalled();
  });
  it("uses serializable mutation, atomic notification/audit and no secret in audit", async () => {
    await service.action(claims, id, input);
    expect(transactions.run).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable",
    });
    expect(repo.lockVet).toHaveBeenCalledWith(vetId, tx);
    expect(repo.assign).toHaveBeenCalledWith(id, vetId, tx);
    expect(repo.notify).toHaveBeenCalledWith(id, vetId, "ASSIGN", tx);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "CONSULTATION_ADMIN_ASSIGNED",
        newValues: expect.objectContaining({ reason: input.reason }),
      }),
      tx,
    );
    expect(JSON.stringify(audit.record.mock.calls)).not.toContain(
      input.actorPassword,
    );
  });
  it("translates serialization conflicts", async () => {
    transactions.run.mockRejectedValue({ code: "P2034" });
    await expect(service.action(claims, id, input)).rejects.toMatchObject({
      errorCode: "CONSULTATION_VERSION_CONFLICT",
      statusCode: 409,
    });
  });
});
describe("Consultation availability/projection rules", () => {
  it("denies unsafe cancellation and ongoing care while preserving assignment availability", () => {
    expect(
      consultationAllowedActions({
        status: "ASSIGNED",
        paymentStatus: "AUTHORIZED",
        paymentIntentId: null,
      } as any),
    ).toEqual(["ASSIGN", "AUTO_ASSIGN"]);
    expect(
      consultationAllowedActions({
        status: "SUBMITTED",
        paymentStatus: "UNPAID",
        paymentIntentId: "provider",
      } as any),
    ).not.toContain("CANCEL");
    for (const status of ["IN_PROGRESS", "COMPLETED", "CANCELLED"])
      expect(
        consultationAllowedActions({
          status,
          paymentStatus: "UNPAID",
          paymentIntentId: null,
        } as any),
      ).toEqual([]);
    expect(
      consultationAllowedActions({
        status: "ASSIGNED",
        paymentStatus: "RELEASED",
        paymentIntentId: null,
      } as any),
    ).toContain("CANCEL");
  });
  const vet = { id: vetId, name: "Vet", vetProfile: profile };
  const consultation = {
    id,
    type: "LIVE_VIDEO",
    scheduledAt: new Date("2026-10-16T04:00:00Z"),
    animal: { species: "CATTLE" },
  };
  it("requires a profile and checks capacity, availability and local working hours", () => {
    expect(
      evaluateConsultationCandidate(
        { ...vet, vetProfile: null } as any,
        consultation as any,
        0,
        false,
      ).ineligibilityReason,
    ).toBe("PROFILE_REQUIRED");
    expect(
      evaluateConsultationCandidate(vet as any, consultation as any, 1, false)
        .ineligibilityReason,
    ).toBe("CAPACITY");
    expect(
      evaluateConsultationCandidate(
        { ...vet, vetProfile: { ...profile, isAvailable: false } } as any,
        consultation as any,
        0,
        false,
      ).ineligibilityReason,
    ).toBe("UNAVAILABLE");
    expect(
      evaluateConsultationCandidate(vet as any, consultation as any, 0, false),
    ).toMatchObject({ isEligible: true, totalScore: 100 });
    expect(
      evaluateConsultationCandidate(
        vet as any,
        {
          ...consultation,
          scheduledAt: new Date("2026-10-16T14:00:00Z"),
        } as any,
        0,
        false,
      ).ineligibilityReason,
    ).toBe("SCHEDULE");
    expect(
      evaluateConsultationCandidate(vet as any, consultation as any, 0, true)
        .ineligibilityReason,
    ).toBe("SCHEDULE");
  });
  it("redacts deleted identities and projects no private fields", () => {
    const row = projectConsultation({
      id,
      farmer: { id, name: "secret", deletedAt: new Date() },
      vet: null,
      farm: { id, name: "Farm", deletedAt: null },
      animal: {
        id,
        name: "secret animal",
        tagNumber: "secret tag",
        species: "CATTLE",
        deletedAt: new Date(),
      },
      passwordHash: "secret",
      paymentIntentId: "provider",
    } as any);
    expect(row.farmer).toBeNull();
    expect(row.animal).toBeNull();
    expect(JSON.stringify(row)).not.toContain("secret");
    expect(row).not.toHaveProperty("paymentIntentId");
  });
});
