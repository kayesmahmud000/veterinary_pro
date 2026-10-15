import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { CourseQuery } from "@vetralink/shared-types";
import { PrismaService } from "../prisma/prisma.service";
const visible = {
  deletedAt: null,
  isPublished: true,
  type: "VIDEO_COURSE",
  contentProvider: "YOUTUBE",
  priceCents: 0,
  discountPriceCents: null,
} satisfies Prisma.ProductWhereInput;
const outline = {
  id: true,
  slug: true,
  title: true,
  description: true,
  courseLessons: {
    where: { deletedAt: null },
    orderBy: { position: "asc" },
    take: 100,
    select: {
      id: true,
      title: true,
      summary: true,
      position: true,
      access: true,
    },
  },
} satisfies Prisma.ProductSelect;
@Injectable()
export class CoursesRepository {
  constructor(private readonly prisma: PrismaService) {}
  published(
    key: { id?: string; slug?: string },
    tx?: Prisma.TransactionClient,
  ) {
    return (tx ?? this.prisma).product.findFirst({
      where: { ...visible, ...key },
      select: outline,
    });
  }
  async lockPublished(id: string, tx: Prisma.TransactionClient) {
    await tx.$queryRaw`SELECT id FROM products WHERE id=${id}::uuid FOR UPDATE`;
    return this.published({ id }, tx);
  }
  async list(query: CourseQuery) {
    const rows = await this.prisma.product.findMany({
      where: {
        ...visible,
        ...(query.cursor ? { id: { gt: query.cursor } } : {}),
        ...(query.search
          ? {
              OR: [
                { title: { contains: query.search, mode: "insensitive" } },
                {
                  description: { contains: query.search, mode: "insensitive" },
                },
              ],
            }
          : {}),
      },
      select: outline,
      orderBy: { id: "asc" },
      take: query.limit + 1,
    });
    return {
      items: rows.slice(0, query.limit),
      nextCursor: rows.length > query.limit ? rows[query.limit - 1].id : null,
    };
  }
  lesson(productId: string, id: string) {
    return this.prisma.courseLesson.findFirst({
      where: { id, productId, deletedAt: null, product: visible },
      select: { id: true, title: true, access: true, youtubeVideoId: true },
    });
  }
  membership(userId: string, productId: string, tx?: Prisma.TransactionClient) {
    return (tx ?? this.prisma).courseEnrollment.findUnique({
      where: { userId_productId: { userId, productId } },
      select: { id: true, productId: true, createdAt: true },
    });
  }
  enroll(userId: string, productId: string, tx: Prisma.TransactionClient) {
    return tx.courseEnrollment.create({
      data: { userId, productId },
      select: { id: true, productId: true, createdAt: true },
    });
  }
  async library(userId: string, query: Omit<CourseQuery, "search">) {
    const rows = await this.prisma.courseEnrollment.findMany({
      where: {
        userId,
        product: visible,
        ...(query.cursor ? { id: { gt: query.cursor } } : {}),
      },
      select: {
        id: true,
        productId: true,
        createdAt: true,
        product: { select: outline },
      },
      orderBy: { id: "asc" },
      take: query.limit + 1,
    });
    return {
      items: rows.slice(0, query.limit),
      nextCursor: rows.length > query.limit ? rows[query.limit - 1].id : null,
    };
  }
}
