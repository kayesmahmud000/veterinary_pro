import { Injectable } from "@nestjs/common";
import { Prisma, CourseEnrollment } from "@prisma/client";
import {
  AdminCourseCandidateQuery,
  AdminCourseEnrollmentQuery,
  adminCourseEnrollmentSchema,
  adminCourseEnrollmentListSchema,
  adminUserCourseListSchema,
  adminCourseCandidateListSchema,
} from "@vetralink/shared-types";
import { PrismaService } from "../prisma/prisma.service";
import { EntityNotFoundException } from "../../common/exceptions/domain.exception";
const identity = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
} as const;
const summary = {
  id: true,
  title: true,
  slug: true,
  isPublished: true,
  deletedAt: true,
} as const;
const json = (v: unknown) => JSON.parse(JSON.stringify(v));
@Injectable()
export class AdminCourseEnrollmentsRepository {
  constructor(private readonly prisma: PrismaService) {}
  project(
    row: CourseEnrollment & { user?: {id:string;name:string;email:string;role:string;status:string} },
    user?: {
      id: string;
      name: string;
      email: string;
      role: string;
      status: string;
    },
  ) {
    return adminCourseEnrollmentSchema.parse(
      json({
        ...row,
        user: user
          ? {
              id: user.id,
              name: user.name,
              email: user.email,
              role: user.role,
              status: user.status,
            }
          : row.user,
      }),
    );
  }
  private async course(id: string, db: Prisma.TransactionClient) {
    const product = await db.product.findFirst({
      where: {
        id,
        deletedAt: null,
        type: "VIDEO_COURSE",
        contentProvider: "YOUTUBE",
      },
    });
    if (!product) throw new EntityNotFoundException("Course");
    return product;
  }
  async list(id: string, q: AdminCourseEnrollmentQuery) {
    return this.prisma.$transaction(
      async (db) => {
        const course = await this.course(id, db),
          base = { productId: id, user: { deletedAt: null } };
        const [activeCount, revokedCount, rows] = await Promise.all([
          db.courseEnrollment.count({ where: { ...base, status: "ACTIVE" } }),
          db.courseEnrollment.count({ where: { ...base, status: "REVOKED" } }),
          db.courseEnrollment.findMany({
            where: {
              ...base,
              ...(q.status === "ALL" ? {} : { status: q.status }),
              ...(q.cursor ? { id: { gt: q.cursor } } : {}),
              user: {
                deletedAt: null,
                ...(q.search
                  ? {
                      OR: [
                        {
                          name: {
                            contains: q.search,
                            mode: "insensitive" as const,
                          },
                        },
                        {
                          email: {
                            contains: q.search,
                            mode: "insensitive" as const,
                          },
                        },
                      ],
                    }
                  : {}),
              },
            },
            include: { user: { select: identity } },
            orderBy: { id: "asc" },
            take: q.limit + 1,
          }),
        ]);
        return adminCourseEnrollmentListSchema.parse(
          json({
            course,
            activeCount,
            revokedCount,
            items: rows.slice(0, q.limit).map((r) => this.project(r)),
            nextCursor: rows.length > q.limit ? rows[q.limit - 1].id : null,
          }),
        );
      },
      { isolationLevel: "RepeatableRead" },
    );
  }
  async userCourses(
    id: string,
    q: Pick<AdminCourseEnrollmentQuery, "limit" | "cursor" | "status">,
  ) {
    return this.prisma.$transaction(
      async (db) => {
        const user = await db.user.findFirst({
          where: { id, deletedAt: null },
          select: identity,
        });
        if (!user) throw new EntityNotFoundException("User");
        const rows = await db.courseEnrollment.findMany({
          where: {
            userId: id,
            ...(q.status === "ALL" ? {} : { status: q.status }),
            ...(q.cursor ? { id: { gt: q.cursor } } : {}),
          },
          include: { product: { select: summary } },
          orderBy: { id: "asc" },
          take: q.limit + 1,
        });
        return adminUserCourseListSchema.parse(
          json({
            user,
            items: rows
              .slice(0, q.limit)
              .map((r) => ({ ...r, course: r.product })),
            nextCursor: rows.length > q.limit ? rows[q.limit - 1].id : null,
          }),
        );
      },
      { isolationLevel: "RepeatableRead" },
    );
  }
  async candidates(id: string, q: AdminCourseCandidateQuery) {
    return this.prisma.$transaction(
      async (db) => {
        const product = await this.course(id, db),
          eligible =
            product.isPublished &&
            product.priceCents === 0 &&
            product.discountPriceCents === null;
        const rows = await db.user.findMany({
          where: {
            deletedAt: null,
            role: { notIn: ["ADMIN", "SUPER_ADMIN"] },
            ...(q.cursor ? { id: { gt: q.cursor } } : {}),
            ...(q.email
              ? { email: q.email }
              : {
                  OR: [
                    { name: { contains: q.search, mode: "insensitive" } },
                    { email: { contains: q.search, mode: "insensitive" } },
                  ],
                }),
          },
          select: {
            ...identity,
            courseEnrollments: {
              where: { productId: id },
              select: { status: true, version: true },
              take: 1,
            },
          },
          orderBy: { id: "asc" },
          take: q.limit + 1,
        });
        const items = rows.slice(0, q.limit).map((r) => {
          const enrollment = r.courseEnrollments[0] ?? null,
            active = r.status === "ACTIVE";
          return {
            ...r,
            enrollment,
            canAdd: active && eligible && !enrollment,
            canRestore: active && eligible && enrollment?.status === "REVOKED",
            denialCode: !active
              ? "ACCOUNT_UNAVAILABLE"
              : !eligible
                ? "COURSE_NOT_ENROLLABLE"
                : enrollment?.status === "REVOKED"
                  ? "ADMIN_REVOKED"
                  : enrollment
                    ? "ALREADY_ENROLLED"
                    : null,
          };
        });
        return adminCourseCandidateListSchema.parse(
          json({
            items,
            nextCursor: rows.length > q.limit ? rows[q.limit - 1].id : null,
          }),
        );
      },
      { isolationLevel: "RepeatableRead" },
    );
  }
}
