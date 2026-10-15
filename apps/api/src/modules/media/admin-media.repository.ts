import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { WorkflowException } from "../../common/exceptions/domain.exception";
import { PrismaService } from "../prisma/prisma.service";
const include = {
  product: {
    select: {
      id: true,
      title: true,
      type: true,
      version: true,
      isPublished: true,
      deletedAt: true,
      metadata: true,
    },
  },
} as const;
export type ManagedUpload = Prisma.AdminMediaUploadGetPayload<{
  include: typeof include;
}>;
@Injectable()
export class AdminMediaRepository {
  constructor(private readonly prisma: PrismaService) {}
  get(id: string, tx?: Prisma.TransactionClient) {
    return (tx ?? this.prisma).adminMediaUpload.findUnique({
      where: { id },
      include,
    });
  }
  async list(q: { limit: number; cursor?: string; productId?: string }) {
    const rows = await this.prisma.adminMediaUpload.findMany({
      where: {
        ...(q.cursor ? { id: { gt: q.cursor } } : {}),
        ...(q.productId ? { productId: q.productId } : {}),
      },
      orderBy: { id: "asc" },
      take: q.limit + 1,
      include,
    });
    return {
      items: rows.slice(0, q.limit),
      nextCursor: rows.length > q.limit ? rows[q.limit - 1]!.id : null,
    };
  }
  create(
    data: Prisma.AdminMediaUploadUncheckedCreateInput,
    tx: Prisma.TransactionClient,
  ) {
    return tx.adminMediaUpload.create({ data, include });
  }
  async set(
    id: string,
    data: Prisma.AdminMediaUploadUpdateManyMutationInput,
    states?: string[],
    tx?: Prisma.TransactionClient,
  ) {
    const result = await (tx ?? this.prisma).adminMediaUpload.updateMany({
      where: { id, ...(states ? { state: { in: states } } : {}) },
      data,
    });
    if (result.count !== 1)
      throw new WorkflowException(
        "UPLOAD_STATE_CONFLICT",
        "Upload changed. Reload its status.",
      );
    return this.get(id, tx);
  }
}
