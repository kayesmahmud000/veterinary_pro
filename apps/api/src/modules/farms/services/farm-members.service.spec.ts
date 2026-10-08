import { randomUUID } from "crypto";
import { FarmRole, UserRole } from "@vetralink/shared-types";
import { FarmMemberEntity } from "../entities/farm-member.entity";
import { FarmMembersService } from "./farm-members.service";
const ownerId = randomUUID(),
  targetId = randomUUID(),
  farmId = randomUUID();
describe("FarmMembersService permissions and transaction", () => {
  let service: FarmMembersService,
    members: any,
    audit: any,
    quota: any,
    actorRole: FarmRole;
  const tx = { transaction: true };
  beforeEach(() => {
    actorRole = FarmRole.OWNER;
    members = {
      findMembership: jest.fn(async (_farm, id) =>
        id === ownerId ? { role: actorRole } : null,
      ),
      create: jest.fn(async (entity) => entity),
      findByFarmId: jest.fn(async () => []),
    };
    audit = { record: jest.fn() };
    quota = { assertQuotaAvailable: jest.fn() };
    service = new FarmMembersService(
      members,
      {
        lockById: jest.fn(async () => ({
          isActive: () => true,
          role: UserRole.FARMER,
          farmerOnboardingRequired: false,
        })),
      } as any,
      { run: async (fn) => fn(tx as any) },
      audit,
      quota,
      {
        lockFarm: async () => ({ id: farmId }),
        memberSummaries: async () => [],
      } as any,
    );
  });
  it.each(Object.values(FarmRole))(
    "lets an owner add %s atomically with audit",
    async (role) => {
      const result = await service.addMember(
        farmId,
        { userId: targetId, role },
        { sub: ownerId } as any,
      );
      expect(result.role).toBe(role);
      expect(members.create).toHaveBeenCalledWith(
        expect.any(FarmMemberEntity),
        tx,
      );
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "FARM_MEMBER_ADDED" }),
        tx,
      );
    },
  );
  it("prevents managers from granting OWNER", async () => {
    actorRole = FarmRole.MANAGER;
    await expect(
      service.addMember(farmId, { userId: targetId, role: FarmRole.OWNER }, {
        sub: ownerId,
      } as any),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(members.create).not.toHaveBeenCalled();
  });
  it("rejects an existing member", async () => {
    members.findMembership.mockResolvedValue({ role: FarmRole.OWNER });
    await expect(
      service.addMember(farmId, { userId: targetId }, { sub: ownerId } as any),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
  it("does not write a member after quota failure", async () => {
    quota.assertQuotaAvailable.mockRejectedValue(new Error("Quota"));
    await expect(
      service.addMember(farmId, { userId: targetId }, { sub: ownerId } as any),
    ).rejects.toThrow("Quota");
    expect(members.create).not.toHaveBeenCalled();
  });
  it("rejects forged roles at the service boundary", async () => {
    await expect(
      service.addMember(
        farmId,
        { userId: targetId, role: "SUPER_ADMIN" } as any,
        { sub: ownerId } as any,
      ),
    ).rejects.toMatchObject({ statusCode: 422 });
  });
  it("returns the current member list", async () => {
    expect(await service.getMembers(farmId)).toEqual({ items: [], total: 0 });
  });
});
