import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AdminProductCreate, AdminProductQuery } from "@vetralink/shared-types";
import { PrismaService } from "../prisma/prisma.service";
import { EntityConflictException } from "../../common/exceptions/domain.exception";
@Injectable()
export class AdminProductsRepository {
  constructor(private readonly prisma: PrismaService) {}
  async list(q: AdminProductQuery) {
    const rows = await this.prisma.product.findMany({
      where: {
        deletedAt: null,
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
    });
    return {
      items: rows.slice(0, q.limit),
      nextCursor: rows.length > q.limit ? rows[q.limit - 1]!.id : null,
    };
  }
  detail(id: string) {
    return this.prisma.product.findFirst({ where: { id, deletedAt: null } });
  }
  async lock(id: string, tx: Prisma.TransactionClient) {
    await tx.$queryRaw`SELECT id FROM products WHERE id=${id}::uuid FOR UPDATE`;
    return tx.product.findFirst({ where: { id, deletedAt: null } });
  }
  async create(input: AdminProductCreate, tx: Prisma.TransactionClient) {
    try {
      return await tx.product.create({
        data: {
          ...input,
          contentS3Key: "",
          isPublished: false,
          metadata: { adminManaged: true },
        },
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
      });
    } catch (e) {
      this.translate(e);
    }
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
