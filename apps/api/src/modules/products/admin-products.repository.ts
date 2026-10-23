import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AdminProductCreate, AdminProductQuery } from "@vetralink/shared-types";
import { PrismaService } from "../prisma/prisma.service";
import { EntityConflictException } from "../../common/exceptions/domain.exception";
const courseRelations = {
  _count: {
    select: {
      courseLessons: { where: { deletedAt: null } },
      courseEnrollments: true,
    },
  },
  courseLessons: {
    where: { deletedAt: null, access: "PUBLIC_DEMO" },
    orderBy: { position: "asc" },
    take: 1,
    select: { youtubeVideoId: true },
  },
} satisfies Prisma.ProductInclude;
@Injectable()
export class AdminProductsRepository {
  constructor(private readonly prisma: PrismaService) {}
  async list(q: AdminProductQuery) {
    const rows = await this.prisma.product.findMany({
      where: {
        deletedAt: null,
        ...(q.slug ? { slug: q.slug } : {}),
        ...(q.contentProvider ? { contentProvider: q.contentProvider } : {}),
        ...(q.cursor ? { id: { gt: q.cursor } } : {}),
        ...(q.type ? { type: q.type } : {}),
        ...(q.publication
          ? { isPublished: q.publication === "PUBLISHED" }
          : {}),
        ...(q.search
          ? {
              OR: [
                { title: { contains: q.search, mode: "insensitive" } },
                { slug: { contains: q.search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { id: "asc" },
      take: q.limit + 1,
      include: courseRelations,
    });
    return {
      items: rows.slice(0, q.limit),
      nextCursor: rows.length > q.limit ? rows[q.limit - 1]!.id : null,
    };
  }
  detail(id: string) {
    return this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      include: courseRelations,
    });
  }
  async lock(id: string, tx: Prisma.TransactionClient) {
    await tx.$queryRaw`SELECT id FROM products WHERE id=${id}::uuid FOR UPDATE`;
    return tx.product.findFirst({
      where: { id, deletedAt: null },
      include: courseRelations,
    });
  }
  async create(input: AdminProductCreate, tx: Prisma.TransactionClient) {
    const { thumbnailUrl, ...fields } = input;
    try {
      return await tx.product.create({
        data: {
          ...fields,
          contentS3Key: "",
          isPublished: false,
          metadata: {
            adminManaged: true,
            ...(thumbnailUrl ? { courseThumbnailUrl: thumbnailUrl } : {}),
          },
        },
        include: courseRelations,
      });
    } catch (e) {
      this.translate(e);
    }
  }
  async save(
    id: string,
    data: Prisma.ProductUpdateInput,
    tx: Prisma.TransactionClient,
  ) {
    try {
      return await tx.product.update({
        where: { id },
        data: { ...data, version: { increment: 1 } },
        include: courseRelations,
      });
    } catch (e) {
      this.translate(e);
    }
  }
  lessons(id: string, tx?: Prisma.TransactionClient) {
    return (tx ?? this.prisma).courseLesson.findMany({
      where: { productId: id, deletedAt: null },
      orderBy: { position: "asc" },
      take: 100,
    });
  }
  async replaceLessons(
    id: string,
    lessons: Array<{
      id: string;
      title: string;
      summary: string;
      access: "PUBLIC_DEMO" | "ENROLLED";
      youtubeVideoId: string;
      position: number;
    }>,
    tx: Prisma.TransactionClient,
  ) {
    const previous = await this.lessons(id, tx);
    for (const [index, lesson] of previous.entries())
      await tx.courseLesson.update({
        where: { id: lesson.id },
        data: { position: -(index + 1) },
      });
    await tx.courseLesson.updateMany({
      where: {
        productId: id,
        deletedAt: null,
        id: { notIn: lessons.map((lesson) => lesson.id) },
      },
      data: { deletedAt: new Date() },
    });
    const active = new Set(previous.map((lesson) => lesson.id));
    for (const lesson of lessons) {
      if (active.has(lesson.id))
        await tx.courseLesson.update({
          where: { id: lesson.id },
          data: lesson,
        });
      else await tx.courseLesson.create({ data: { ...lesson, productId: id } });
    }
    return this.lessons(id, tx);
  }
  private translate(e: unknown): never {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
      throw new EntityConflictException(
        "Product slug is already in use.",
        "slug",
      );
    throw e;
  }
}
