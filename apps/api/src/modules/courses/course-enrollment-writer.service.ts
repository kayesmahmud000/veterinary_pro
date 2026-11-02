import { Injectable } from "@nestjs/common";
import { Prisma, Product } from "@prisma/client";
import { WorkflowException } from "../../common/exceptions/domain.exception";
import {
  CourseEnrollmentPersistence,
  LockedEnrollment as Context,
} from "./course-enrollment.repository";
export const enrollmentConflict = () =>
  new WorkflowException(
    "ENROLLMENT_VERSION_CONFLICT",
    "Membership changed. Reload and retry.",
    409,
  );
export function assertEnrollable(product: Product) {
  if (
    product.deletedAt ||
    !product.isPublished ||
    product.type !== "VIDEO_COURSE" ||
    product.contentProvider !== "YOUTUBE" ||
    product.priceCents !== 0 ||
    product.discountPriceCents !== null
  )
    throw new WorkflowException(
      "COURSE_NOT_ENROLLABLE",
      "This course is not available for enrollment.",
      409,
    );
}
@Injectable()
export class CourseEnrollmentWriter {
  private readonly persistence = new CourseEnrollmentPersistence();
  lock(productId: string, userId: string, tx: Prisma.TransactionClient) {
    return this.persistence.lock(productId, userId, tx);
  }
  async activateLocked(
    c: Context,
    mode: "SELF" | "ADD" | "RESTORE",
    expectedVersion: number | null | undefined,
    tx: Prisma.TransactionClient,
  ) {
    assertEnrollable(c.product);
    const old = c.membership;
    if (old?.status === "REVOKED" && mode === "SELF")
      throw new WorkflowException(
        "COURSE_ENROLLMENT_REVOKED",
        "Course access was removed by an administrator.",
        403,
      );
    if (mode === "RESTORE") {
      if (!old || old.version !== expectedVersion) throw enrollmentConflict();
      if (old.status === "ACTIVE") return { enrollment: old, changed: false };
      const now = await this.persistence.now(tx);
      const enrollment = await this.persistence.save(
        old.id,
        {
          status: "ACTIVE",
          source: "ADMIN",
          version: { increment: 1 },
          activatedAt: now,
          revokedAt: null,
          revokedById: null,
        },
        tx,
      );
      return { enrollment, changed: true };
    }
    if (old) {
      if (old.status === "REVOKED") throw enrollmentConflict();
      return { enrollment: old, changed: false };
    }
    const enrollment = await this.persistence.create(
      c.userId,
      c.productId,
      mode === "SELF" ? "SELF" : "ADMIN",
      tx,
    );
    return { enrollment, changed: true };
  }
  async revokeLocked(
    c: Context,
    actorId: string,
    expectedVersion: number,
    tx: Prisma.TransactionClient,
  ) {
    const old = c.membership;
    if (!old || old.version !== expectedVersion) throw enrollmentConflict();
    if (old.status === "REVOKED") return { enrollment: old, changed: false };
    const now = await this.persistence.now(tx);
    const enrollment = await this.persistence.save(
      old.id,
      {
        status: "REVOKED",
        version: { increment: 1 },
        revokedAt: now,
        revokedById: actorId,
      },
      tx,
    );
    return { enrollment, changed: true };
  }
}
