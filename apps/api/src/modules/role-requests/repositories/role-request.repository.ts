import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  RoleDecisionInput,
  SubmitRoleRequestInput,
} from "@vetralink/shared-types";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class RoleRequestRepository {
  constructor(private readonly prisma: PrismaService) {}
  find(id: string, tx?: Prisma.TransactionClient) {
    return (tx ?? this.prisma).roleUpgradeRequest.findUnique({ where: { id } });
  }
  async lock(id: string, tx: Prisma.TransactionClient) {
    await tx.$queryRaw`SELECT id FROM role_upgrade_requests WHERE id = ${id}::uuid FOR UPDATE`;
    return this.find(id, tx);
  }
  findKey(
    applicantUserId: string,
    submissionKey: string,
    tx: Prisma.TransactionClient,
  ) {
    return tx.roleUpgradeRequest.findUnique({
      where: {
        applicantUserId_submissionKey: { applicantUserId, submissionKey },
      },
    });
  }
  pending(applicantUserId: string, tx: Prisma.TransactionClient) {
    return tx.roleUpgradeRequest.findFirst({
      where: { applicantUserId, status: "PENDING" },
    });
  }
  create(
    applicantUserId: string,
    input: SubmitRoleRequestInput,
    payloadHash: string,
    answers: Prisma.InputJsonValue,
    tx: Prisma.TransactionClient,
  ) {
    return tx.roleUpgradeRequest.create({
      data: {
        applicantUserId,
        targetRole: input.targetRole,
        locale: input.locale,
        questionnaireVersion: input.questionnaireVersion,
        submissionKey: input.submissionKey,
        payloadHash,
        answers,
      },
    });
  }
  decide(
    id: string,
    reviewerUserId: string,
    input: RoleDecisionInput,
    tx: Prisma.TransactionClient,
  ) {
    return tx.roleUpgradeRequest.update({
      where: { id },
      data: {
        status: input.decision,
        reviewerUserId,
        decidedAt: new Date(),
        requestVersion: { increment: 1 },
        publicDecisionReason: input.publicReason,
        privateReviewNote: input.privateNote,
        qualificationVerificationNote: input.qualificationVerificationNote,
      },
    });
  }
  async list(filter: {
    userId?: string;
    status?: "PENDING" | "APPROVED" | "REJECTED";
    targetRole?: "FARMER" | "VET" | "BUYER";
    limit: number;
    cursor?: string;
  }) {
    const rows = await this.prisma.roleUpgradeRequest.findMany({
      where: {
        ...(filter.userId ? { applicantUserId: filter.userId } : {}),
        ...(filter.status ? { status: filter.status } : {}),
        ...(filter.targetRole ? { targetRole: filter.targetRole } : {}),
      },
      include: {
        applicant: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            status: true,
            roleVersion: true,
            deletedAt: true,
          },
        },
      },
      orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
      take: filter.limit + 1,
      ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
    });
    return {
      rows: rows.slice(0, filter.limit),
      nextCursor:
        rows.length > filter.limit ? rows[filter.limit - 1]!.id : null,
    };
  }
  async initializeVet(
    userId: string,
    answers: any,
    tx: Prisma.TransactionClient,
  ) {
    await tx.vetProfile.upsert({
      where: { userId },
      create: {
        userId,
        licenseNumber: answers.licenseNumber,
        specialties: answers.species,
        isAvailable: false,
        timezone: "Asia/Dhaka",
      },
      update: {
        licenseNumber: answers.licenseNumber,
        specialties: answers.species,
        isAvailable: false,
      },
    });
  }
}
