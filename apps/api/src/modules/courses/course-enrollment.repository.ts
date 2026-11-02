import { Prisma, CourseEnrollment, Product } from "@prisma/client";
import { EntityNotFoundException } from "../../common/exceptions/domain.exception";
export type LockedEnrollment = {
  product: Product;
  membership: CourseEnrollment | null;
  userId: string;
  productId: string;
};
export class CourseEnrollmentPersistence {
  async lock(
    productId: string,
    userId: string,
    tx: Prisma.TransactionClient,
  ): Promise<LockedEnrollment> {
    await tx.$queryRaw`SELECT id FROM products WHERE id=${productId}::uuid FOR UPDATE`;
    const product = await tx.product.findUnique({ where: { id: productId } });
    if (
      !product ||
      product.deletedAt ||
      product.type !== "VIDEO_COURSE" ||
      product.contentProvider !== "YOUTUBE"
    )
      throw new EntityNotFoundException("Course");
    const membership = await tx.courseEnrollment.findUnique({
      where: { userId_productId: { userId, productId } },
    });
    return { product, membership, userId, productId };
  }
  async now(tx: Prisma.TransactionClient) {
    const [clock] = await tx.$queryRaw<
      Array<{ now: Date }>
    >`SELECT clock_timestamp() AS now`;
    return clock.now;
  }
  create(
    userId: string,
    productId: string,
    source: "SELF" | "ADMIN",
    tx: Prisma.TransactionClient,
  ) {
    return tx.courseEnrollment.create({ data: { userId, productId, source } });
  }
  save(
    id: string,
    data: Prisma.CourseEnrollmentUncheckedUpdateInput,
    tx: Prisma.TransactionClient,
  ) {
    return tx.courseEnrollment.update({ where: { id }, data });
  }
}
