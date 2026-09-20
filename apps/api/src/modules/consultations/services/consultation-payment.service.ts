import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import {
  CaptureConsultationPaymentResultDto,
  ConsultationPaymentHoldResultDto,
  ConsultationPaymentStatus,
  ReleaseConsultationHoldResultDto,
} from "@vetralink/shared-types";
import {
  EntityNotFoundException,
  ValidationDomainException,
} from "../../../common/exceptions/domain.exception";
import {
  AUDIT_LOG_REPOSITORY,
  IAuditLogRepository,
} from "../../audit/repositories/audit-log.repository.interface";
import { PrismaService } from "../../prisma/prisma.service";
import {
  CONSULTATION_REPOSITORY,
  IConsultationRepository,
} from "../repositories/consultation.repository.interface";
import {
  CONSULTATION_PAYMENT_GATEWAY,
  IConsultationPaymentGateway,
} from "./consultation-payment-gateway.interface";
import { IConsultationPaymentService } from "./consultation-payment.service.interface";
import {
  IVetPayoutLedgerService,
  VET_PAYOUT_LEDGER_SERVICE,
} from "./vet-payout-ledger.service.interface";

@Injectable()
export class ConsultationPaymentService implements IConsultationPaymentService {
  private readonly logger = new Logger(ConsultationPaymentService.name);

  constructor(
    @Inject(CONSULTATION_REPOSITORY)
    private readonly consultationRepo: IConsultationRepository,
    @Inject(CONSULTATION_PAYMENT_GATEWAY)
    private readonly paymentGateway: IConsultationPaymentGateway,
    @Inject(AUDIT_LOG_REPOSITORY)
    private readonly auditLogRepo: IAuditLogRepository,
    private readonly prisma: PrismaService,
    @Inject(VET_PAYOUT_LEDGER_SERVICE)
    @Optional()
    private readonly vetPayoutLedgerService?: IVetPayoutLedgerService,
  ) {}

  public async createHold(
    consultationId: string,
    farmId: string,
    userId: string,
    traceId?: string,
  ): Promise<ConsultationPaymentHoldResultDto> {
    this.logger.log(
      `[${traceId ?? "NO-TRACE"}] Creating authorization hold for consultation '${consultationId}', user '${userId}'`,
    );

    const consultation = await this.consultationRepo.findById(consultationId, farmId);
    if (!consultation) {
      throw new EntityNotFoundException("Consultation", consultationId);
    }

    if (consultation.paymentStatus === ConsultationPaymentStatus.CAPTURED) {
      throw new ValidationDomainException(
        "Consultation payment has already been captured.",
      );
    }

    // Zero-fee handling (e.g. routine checks covered by tier)
    if (consultation.feeCents === 0) {
      consultation.capturePayment();
      await this.consultationRepo.save(consultation);

      return {
        consultationId: consultation.id,
        paymentIntentId: "fee_waived_zero",
        amountCents: 0,
        currency: consultation.currency,
        paymentStatus: ConsultationPaymentStatus.CAPTURED,
      };
    }

    // Idempotent return if already authorized
    if (
      consultation.paymentStatus === ConsultationPaymentStatus.AUTHORIZED &&
      consultation.paymentIntentId
    ) {
      return {
        consultationId: consultation.id,
        paymentIntentId: consultation.paymentIntentId,
        amountCents: consultation.feeCents,
        currency: consultation.currency,
        paymentStatus: ConsultationPaymentStatus.AUTHORIZED,
      };
    }

    // Retrieve farmer email if available
    let customerEmail: string | undefined;
    const farmerUser = await this.prisma.user.findUnique({
      where: { id: consultation.farmerId },
      select: { email: true },
    });
    if (farmerUser?.email) {
      customerEmail = farmerUser.email;
    }

    const holdResult = await this.paymentGateway.createAuthorizationHold(
      consultation.id,
      consultation.feeCents,
      consultation.currency,
      customerEmail,
      {
        farmId: consultation.farmId,
        farmerId: consultation.farmerId,
        requestedByUserId: userId,
      },
    );

    consultation.placePaymentHold(holdResult.paymentIntentId);
    const saved = await this.consultationRepo.save(consultation);

    await this.auditLogRepo.record({
      userId,
      action: "CONSULTATION_PAYMENT_HOLD_CREATED",
      entityType: "Consultation",
      entityId: saved.id,
      newValues: {
        paymentIntentId: holdResult.paymentIntentId,
        amountCents: holdResult.amountCents,
        currency: holdResult.currency,
        paymentStatus: saved.paymentStatus,
      },
      traceId: traceId ?? crypto.randomUUID(),
    });

    return {
      consultationId: saved.id,
      paymentIntentId: holdResult.paymentIntentId,
      clientSecret: holdResult.clientSecret,
      amountCents: holdResult.amountCents,
      currency: holdResult.currency,
      paymentStatus: saved.paymentStatus,
    };
  }

  public async confirmHold(
    consultationId: string,
    paymentIntentId: string,
    userId: string,
    traceId?: string,
  ): Promise<ConsultationPaymentHoldResultDto> {
    this.logger.log(
      `[${traceId ?? "NO-TRACE"}] Confirming authorization hold '${paymentIntentId}' for consultation '${consultationId}'`,
    );

    const consultation = await this.consultationRepo.findById(consultationId);
    if (!consultation) {
      throw new EntityNotFoundException("Consultation", consultationId);
    }

    if (
      consultation.paymentIntentId &&
      consultation.paymentIntentId !== paymentIntentId
    ) {
      throw new ValidationDomainException(
        "Payment intent ID does not match the hold initiated for this consultation.",
      );
    }

    if (consultation.paymentStatus !== ConsultationPaymentStatus.AUTHORIZED) {
      consultation.placePaymentHold(paymentIntentId);
      await this.consultationRepo.save(consultation);

      await this.auditLogRepo.record({
        userId,
        action: "CONSULTATION_PAYMENT_HOLD_CONFIRMED",
        entityType: "Consultation",
        entityId: consultation.id,
        newValues: {
          paymentIntentId,
          paymentStatus: consultation.paymentStatus,
        },
        traceId: traceId ?? crypto.randomUUID(),
      });
    }

    return {
      consultationId: consultation.id,
      paymentIntentId,
      amountCents: consultation.feeCents,
      currency: consultation.currency,
      paymentStatus: consultation.paymentStatus,
    };
  }

  public async capturePayment(
    consultationId: string,
    userId: string,
    traceId?: string,
  ): Promise<CaptureConsultationPaymentResultDto> {
    this.logger.log(
      `[${traceId ?? "NO-TRACE"}] Capturing payment for consultation '${consultationId}' by user '${userId}'`,
    );

    const consultation = await this.consultationRepo.findById(consultationId);
    if (!consultation) {
      throw new EntityNotFoundException("Consultation", consultationId);
    }

    if (consultation.paymentStatus === ConsultationPaymentStatus.CAPTURED) {
      return {
        consultationId: consultation.id,
        paymentIntentId: consultation.paymentIntentId ?? "fee_waived_zero",
        amountCents: consultation.feeCents,
        paymentStatus: consultation.paymentStatus,
        capturedAt: (consultation.paymentCapturedAt ?? new Date()).toISOString(),
      };
    }

    if (consultation.feeCents === 0) {
      consultation.capturePayment();
      const saved = await this.consultationRepo.save(consultation);
      return {
        consultationId: saved.id,
        paymentIntentId: "fee_waived_zero",
        amountCents: 0,
        paymentStatus: saved.paymentStatus,
        capturedAt: (saved.paymentCapturedAt ?? new Date()).toISOString(),
      };
    }

    if (consultation.paymentStatus !== ConsultationPaymentStatus.AUTHORIZED) {
      throw new ValidationDomainException(
        `Cannot capture payment for consultation in status '${consultation.paymentStatus}'. Must be in 'AUTHORIZED' status.`,
      );
    }

    if (!consultation.paymentIntentId) {
      throw new ValidationDomainException(
        "Consultation does not have an associated payment intent ID to capture.",
      );
    }

    await this.paymentGateway.captureHold(
      consultation.paymentIntentId,
      consultation.feeCents,
    );

    consultation.capturePayment();
    const saved = await this.consultationRepo.save(consultation);

    // Record settlement in payout ledger if feeCents > 0 and vetId is present
    if (this.vetPayoutLedgerService && saved.feeCents > 0 && saved.vetId) {
      try {
        await this.vetPayoutLedgerService.recordConsultationSettlement(
          saved.id,
          undefined,
          traceId,
        );
      } catch (err) {
        this.logger.error(
          `Failed to record payout settlement for consultation '${saved.id}': ${err}`,
        );
      }
    }

    await this.auditLogRepo.record({
      userId,
      action: "CONSULTATION_PAYMENT_CAPTURED",
      entityType: "Consultation",
      entityId: saved.id,
      newValues: {
        paymentIntentId: saved.paymentIntentId,
        amountCents: saved.feeCents,
        paymentStatus: saved.paymentStatus,
        capturedAt: saved.paymentCapturedAt,
      },
      traceId: traceId ?? crypto.randomUUID(),
    });

    return {
      consultationId: saved.id,
      paymentIntentId: saved.paymentIntentId!,
      amountCents: saved.feeCents,
      paymentStatus: saved.paymentStatus,
      capturedAt: (saved.paymentCapturedAt ?? new Date()).toISOString(),
    };
  }

  public async releaseHold(
    consultationId: string,
    reason: string,
    userId: string,
    traceId?: string,
  ): Promise<ReleaseConsultationHoldResultDto> {
    this.logger.log(
      `[${traceId ?? "NO-TRACE"}] Releasing authorization hold for consultation '${consultationId}', reason: '${reason}'`,
    );

    const consultation = await this.consultationRepo.findById(consultationId);
    if (!consultation) {
      throw new EntityNotFoundException("Consultation", consultationId);
    }

    if (consultation.paymentStatus === ConsultationPaymentStatus.RELEASED) {
      return {
        consultationId: consultation.id,
        paymentIntentId: consultation.paymentIntentId ?? "none",
        paymentStatus: consultation.paymentStatus,
        releasedAt: (consultation.paymentReleasedAt ?? new Date()).toISOString(),
        reason,
      };
    }

    if (consultation.paymentStatus === ConsultationPaymentStatus.CAPTURED) {
      throw new ValidationDomainException(
        "Cannot release payment that has already been captured. A refund must be issued instead.",
      );
    }

    if (
      consultation.paymentStatus === ConsultationPaymentStatus.AUTHORIZED &&
      consultation.paymentIntentId &&
      consultation.paymentIntentId !== "fee_waived_zero"
    ) {
      await this.paymentGateway.releaseHold(consultation.paymentIntentId);
    }

    consultation.releasePaymentHold();
    const saved = await this.consultationRepo.save(consultation);

    await this.auditLogRepo.record({
      userId,
      action: "CONSULTATION_PAYMENT_HOLD_RELEASED",
      entityType: "Consultation",
      entityId: saved.id,
      newValues: {
        paymentIntentId: saved.paymentIntentId,
        paymentStatus: saved.paymentStatus,
        reason,
        releasedAt: saved.paymentReleasedAt,
      },
      traceId: traceId ?? crypto.randomUUID(),
    });

    return {
      consultationId: saved.id,
      paymentIntentId: saved.paymentIntentId ?? "none",
      paymentStatus: saved.paymentStatus,
      releasedAt: (saved.paymentReleasedAt ?? new Date()).toISOString(),
      reason,
    };
  }
}
