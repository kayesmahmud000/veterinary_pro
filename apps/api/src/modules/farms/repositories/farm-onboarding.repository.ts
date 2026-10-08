import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { FarmOnboardingInput } from "@vetralink/shared-types";
import { randomUUID } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class FarmOnboardingRepository {
  constructor(private readonly prisma: PrismaService) {}
  async memberSummaries(farmId: string) {
    const rows = await this.prisma.farmMember.findMany({
      where: { farmId },
      select: {
        id: true,
        userId: true,
        farmId: true,
        role: true,
        createdAt: true,
        user: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(({ user, ...member }) => ({
      ...member,
      role: member.role as import("@vetralink/shared-types").FarmRole,
      createdAt: member.createdAt.toISOString(),
      displayName: user.name,
    }));
  }
  async findCompleted(userId: string, tx: Prisma.TransactionClient) {
    return tx.farmerOnboarding.findUnique({ where: { userId } });
  }
  async farms(userId: string, tx?: Prisma.TransactionClient) {
    const rows = await (tx ?? this.prisma).farmMember.findMany({
      where: { userId, farm: { deletedAt: null } },
      include: { farm: true },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((m) => ({
      id: m.farm.id,
      ownerId: m.farm.ownerId,
      name: m.farm.name,
      farmType: m.farm.farmType,
      country: m.farm.country,
      address: m.farm.address,
      role: m.role,
    }));
  }
  async createFarm(
    userId: string,
    input: Extract<FarmOnboardingInput, { mode: "create" }>,
    tx: Prisma.TransactionClient,
  ) {
    const id = randomUUID();
    const farm = await tx.farm.create({
      data: {
        id,
        ownerId: userId,
        name: input.name,
        slug: `farm-${id}`,
        farmType: input.farmType,
        country: input.country,
        address: input.address,
        gpsLat: input.gpsLat,
        gpsLng: input.gpsLng,
        settings: {
          district: input.district,
          upazila: input.upazila,
          species: input.species,
          animalCount: input.animalCount,
          experienceYears: input.experienceYears,
        },
      },
    });
    await tx.farmMember.create({ data: { farmId: id, userId, role: "OWNER" } });
    return farm.id;
  }
  async complete(
    userId: string,
    farmId: string,
    submissionKey: string,
    payloadHash: string,
    tx: Prisma.TransactionClient,
  ) {
    await tx.farmerOnboarding.upsert({
      where: { userId },
      create: { userId, farmId, submissionKey, payloadHash },
      update: { farmId, submissionKey, payloadHash, completedAt: new Date() },
    });
    await tx.user.update({
      where: { id: userId },
      data: { farmerOnboardingRequired: false },
    });
  }
  async lockFarm(farmId: string, tx: Prisma.TransactionClient) {
    await tx.$queryRaw`SELECT id FROM farms WHERE id = ${farmId}::uuid FOR UPDATE`;
    return tx.farm.findFirst({ where: { id: farmId, deletedAt: null } });
  }
}
