import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { VetProfileEntity } from "../entities/vet-profile.entity";
import {
  IVetProfileRepository,
  VetWithProfileRecord,
} from "./vet-profile.repository.interface";

@Injectable()
export class VetProfileRepository implements IVetProfileRepository {
  constructor(private readonly prisma: PrismaService) {}

  public async findByUserId(userId: string): Promise<VetProfileEntity | null> {
    const record = await this.prisma.vetProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (!record) {
      return null;
    }

    return VetProfileEntity.fromPersistence(record);
  }

  public async save(entity: VetProfileEntity): Promise<VetProfileEntity> {
    const record = await this.prisma.vetProfile.upsert({
      where: { userId: entity.userId },
      create: {
        id: entity.id,
        userId: entity.userId,
        specialties: entity.specialties as unknown as Prisma.InputJsonValue,
        isAvailable: entity.isAvailable,
        maxActiveCases: entity.maxActiveCases,
        workingHours: entity.workingHours as unknown as Prisma.InputJsonValue,
        timezone: entity.timezone,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt,
      },
      update: {
        specialties: entity.specialties as unknown as Prisma.InputJsonValue,
        isAvailable: entity.isAvailable,
        maxActiveCases: entity.maxActiveCases,
        workingHours: entity.workingHours as unknown as Prisma.InputJsonValue,
        timezone: entity.timezone,
        updatedAt: entity.updatedAt,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    return VetProfileEntity.fromPersistence(record);
  }

  public async findAllActiveVetsWithProfiles(): Promise<VetWithProfileRecord[]> {
    const users = await this.prisma.user.findMany({
      where: {
        role: "VET",
        status: "ACTIVE",
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        role: true,
        status: true,
        vetProfile: true,
      },
      orderBy: { name: "asc" },
    });

    return users.map((u) => ({
      user: {
        id: u.id,
        name: u.name,
        email: u.email,
        avatarUrl: u.avatarUrl,
        role: u.role,
        status: u.status,
      },
      profile: u.vetProfile
        ? VetProfileEntity.fromPersistence({
            ...u.vetProfile,
            user: {
              id: u.id,
              name: u.name,
              email: u.email,
              avatarUrl: u.avatarUrl,
            },
          })
        : null,
    }));
  }

  public async updateRatingAggregates(
    userId: string,
    averageRating: number,
    totalReviews: number,
  ): Promise<void> {
    await this.prisma.vetProfile.updateMany({
      where: { userId },
      data: {
        averageRating,
        totalReviews,
      },
    });
  }
}
