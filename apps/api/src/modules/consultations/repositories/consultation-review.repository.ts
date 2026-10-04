import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  ReviewModerationStatus,
  ReviewQueryDto,
  VetRatingSummaryDto,
} from "@vetralink/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { ConsultationReviewEntity } from "../entities/consultation-review.entity";
import { IConsultationReviewRepository } from "./consultation-review.repository.interface";

const REVIEW_INCLUDE = {
  farmer: {
    select: {
      id: true,
      name: true,
    },
  },
  vet: {
    select: {
      id: true,
      name: true,
    },
  },
} as const;

@Injectable()
export class ConsultationReviewRepository
  implements IConsultationReviewRepository
{
  constructor(private readonly prisma: PrismaService) {}

  public async create(
    entity: ConsultationReviewEntity,
    tx?: Prisma.TransactionClient,
  ): Promise<ConsultationReviewEntity> {
    const client = tx ?? this.prisma;
    const record = await client.consultationReview.create({
      data: {
        id: entity.id,
        consultationId: entity.consultationId,
        farmerId: entity.farmerId,
        vetId: entity.vetId,
        rating: entity.rating,
        feedback: entity.feedback,
        tags: entity.tags as Prisma.InputJsonValue,
        isPublic: entity.isPublic,
        moderationStatus: entity.moderationStatus,
        moderatedById: entity.moderatedById,
        moderatedAt: entity.moderatedAt,
        moderationReason: entity.moderationReason,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt,
      },
      include: REVIEW_INCLUDE,
    });

    return this.toEntity(record);
  }

  public async save(
    entity: ConsultationReviewEntity,
    tx?: Prisma.TransactionClient,
  ): Promise<ConsultationReviewEntity> {
    const client = tx ?? this.prisma;
    const record = await client.consultationReview.update({
      where: { id: entity.id },
      data: {
        rating: entity.rating,
        feedback: entity.feedback,
        tags: entity.tags as Prisma.InputJsonValue,
        isPublic: entity.isPublic,
        moderationStatus: entity.moderationStatus,
        moderatedById: entity.moderatedById,
        moderatedAt: entity.moderatedAt,
        moderationReason: entity.moderationReason,
        updatedAt: entity.updatedAt,
      },
      include: REVIEW_INCLUDE,
    });

    return this.toEntity(record);
  }

  public async findById(id: string): Promise<ConsultationReviewEntity | null> {
    const record = await this.prisma.consultationReview.findUnique({
      where: { id },
      include: REVIEW_INCLUDE,
    });

    if (!record) {
      return null;
    }

    return this.toEntity(record);
  }

  public async findByConsultationId(
    consultationId: string,
  ): Promise<ConsultationReviewEntity | null> {
    const record = await this.prisma.consultationReview.findUnique({
      where: { consultationId },
      include: REVIEW_INCLUDE,
    });

    if (!record) {
      return null;
    }

    return this.toEntity(record);
  }

  public async findMany(
    query: ReviewQueryDto,
  ): Promise<{ items: ConsultationReviewEntity[]; total: number }> {
    const where: Prisma.ConsultationReviewWhereInput = {};

    if (query.vetId) {
      where.vetId = query.vetId;
    }
    if (query.farmerId) {
      where.farmerId = query.farmerId;
    }
    if (query.moderationStatus) {
      where.moderationStatus = query.moderationStatus;
    }
    if (query.minRating !== undefined || query.maxRating !== undefined) {
      where.rating = {};
      if (query.minRating !== undefined) {
        where.rating.gte = query.minRating;
      }
      if (query.maxRating !== undefined) {
        where.rating.lte = query.maxRating;
      }
    }

    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const skip = (page - 1) * limit;

    const [records, total] = await Promise.all([
      this.prisma.consultationReview.findMany({
        where,
        include: REVIEW_INCLUDE,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.consultationReview.count({ where }),
    ]);

    return {
      items: records.map((r) => this.toEntity(r)),
      total,
    };
  }

  public async findVetRatingSummary(vetId: string): Promise<VetRatingSummaryDto> {
    const records = await this.prisma.consultationReview.findMany({
      where: {
        vetId,
        moderationStatus: ReviewModerationStatus.APPROVED,
        isPublic: true,
      },
    });

    const totalReviews = records.length;
    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const tagCountMap = new Map<string, number>();

    let ratingSum = 0;
    for (const r of records) {
      ratingSum += r.rating;
      if (r.rating >= 1 && r.rating <= 5) {
        ratingDistribution[r.rating as 1 | 2 | 3 | 4 | 5]++;
      }

      const tags = (r.tags as string[]) ?? [];
      for (const t of tags) {
        tagCountMap.set(t, (tagCountMap.get(t) ?? 0) + 1);
      }
    }

    const averageRating =
      totalReviews > 0
        ? Math.round((ratingSum / totalReviews) * 100) / 100
        : 0;

    const topTags = Array.from(tagCountMap.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);

    return {
      vetId,
      averageRating,
      totalReviews,
      ratingDistribution,
      topTags,
    };
  }

  private toEntity(record: any): ConsultationReviewEntity {
    return ConsultationReviewEntity.fromPersistence({
      id: record.id,
      consultationId: record.consultationId,
      farmerId: record.farmerId,
      vetId: record.vetId,
      rating: record.rating,
      feedback: record.feedback,
      tags: (record.tags as string[]) ?? [],
      isPublic: record.isPublic,
      moderationStatus: record.moderationStatus as ReviewModerationStatus,
      moderatedById: record.moderatedById,
      moderatedAt: record.moderatedAt,
      moderationReason: record.moderationReason,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      farmer: record.farmer,
      vet: record.vet,
    });
  }
}
