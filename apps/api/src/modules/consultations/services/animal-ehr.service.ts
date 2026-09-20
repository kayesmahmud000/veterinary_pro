import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  AnimalEhrResponseDto,
  AnimalGender,
  AnimalSpecies,
  AnimalStatus,
  ConsultationStatus,
  ConsultationType,
  EhrActiveWithdrawalAlertDto,
  EhrAnimalSummaryDto,
  EhrClinicalHighlightsDto,
  EhrClinicalIncidentDto,
  EhrConsultationHistoryDto,
  EhrMilkProductionSummaryDto,
  EhrPrescriptionHistoryDto,
  EhrPreventativeRecordDto,
  EhrWeightRecordDto,
  HealthEventType,
  JwtPayload,
  MilkAnomalySeverity,
  MilkAnomalyStatus,
  MilkSession,
  SeverityLevel,
  UserRole,
  VaccineRecordType,
} from "@vetralink/shared-types";
import {
  EntityNotFoundException,
  ForbiddenOperationException,
  ValidationDomainException,
} from "../../../common/exceptions/domain.exception";
import {
  AUDIT_LOG_REPOSITORY,
  IAuditLogRepository,
} from "../../audit/repositories/audit-log.repository.interface";
import { PrismaService } from "../../prisma/prisma.service";
import { IAnimalEhrService } from "./animal-ehr.service.interface";

@Injectable()
export class AnimalEhrService implements IAnimalEhrService {
  private readonly logger = new Logger(AnimalEhrService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(AUDIT_LOG_REPOSITORY)
    private readonly auditLogRepo: IAuditLogRepository,
  ) {}

  public async getConsultationEhr(
    consultationId: string,
    requestingUser: JwtPayload,
    traceId?: string,
  ): Promise<AnimalEhrResponseDto> {
    const consultation = await this.prisma.consultation.findUnique({
      where: { id: consultationId },
      include: {
        farm: true,
      },
    });

    if (!consultation) {
      throw new EntityNotFoundException("Consultation", consultationId);
    }

    // Check authorization:
    // User must be: ADMIN, SUPER_ADMIN, or the assigned vet, or the farmer, or a member of the farm
    const isSuperOrAdmin =
      requestingUser.role === UserRole.ADMIN ||
      requestingUser.role === UserRole.SUPER_ADMIN;
    const isAssignedVet = consultation.vetId === requestingUser.sub;
    const isFarmer = consultation.farmerId === requestingUser.sub;

    if (!isSuperOrAdmin && !isAssignedVet && !isFarmer) {
      const membership = await this.prisma.farmMember.findUnique({
        where: {
          farmId_userId: {
            farmId: consultation.farmId,
            userId: requestingUser.sub,
          },
        },
      });

      if (!membership) {
        throw new ForbiddenOperationException(
          "You do not have permission to view the Electronic Health Record for this consultation.",
        );
      }
    }

    if (!consultation.animalId) {
      throw new ValidationDomainException(
        "This consultation has no associated individual animal record.",
      );
    }

    return this.buildAnimalEhr(
      consultation.animalId,
      requestingUser,
      consultationId,
      traceId,
    );
  }

  public async getAnimalEhr(
    animalId: string,
    requestingUser: JwtPayload,
    traceId?: string,
  ): Promise<AnimalEhrResponseDto> {
    const animal = await this.prisma.animal.findUnique({
      where: { id: animalId },
    });

    if (!animal || animal.deletedAt !== null) {
      throw new EntityNotFoundException("Animal", animalId);
    }

    // Check authorization:
    // Admin, farm member/owner, or attending vet on an active consultation for this animal
    const isSuperOrAdmin =
      requestingUser.role === UserRole.ADMIN ||
      requestingUser.role === UserRole.SUPER_ADMIN;

    if (!isSuperOrAdmin) {
      const membership = await this.prisma.farmMember.findUnique({
        where: {
          farmId_userId: {
            farmId: animal.farmId,
            userId: requestingUser.sub,
          },
        },
      });

      if (!membership) {
        const farm = await this.prisma.farm.findUnique({
          where: { id: animal.farmId },
        });

        if (farm?.ownerId !== requestingUser.sub) {
          // Check if attending vet has an active consultation for this animal
          const hasConsultation = await this.prisma.consultation.findFirst({
            where: {
              animalId,
              vetId: requestingUser.sub,
              status: { in: [ConsultationStatus.ASSIGNED, ConsultationStatus.IN_PROGRESS] },
            },
          });

          if (!hasConsultation) {
            throw new ForbiddenOperationException(
              "You do not have permission to view this animal's Electronic Health Record.",
            );
          }
        }
      }
    }

    return this.buildAnimalEhr(animalId, requestingUser, undefined, traceId);
  }

  private async buildAnimalEhr(
    animalId: string,
    requestingUser: JwtPayload,
    consultationId?: string,
    traceId?: string,
  ): Promise<AnimalEhrResponseDto> {
    const now = new Date();

    // 1. Fetch animal master data with relations
    const animal = await this.prisma.animal.findUnique({
      where: { id: animalId },
      include: {
        farm: true,
        sire: {
          select: { id: true, tagNumber: true, species: true },
        },
        dam: {
          select: { id: true, tagNumber: true, species: true },
        },
      },
    });

    if (!animal || animal.deletedAt !== null) {
      throw new EntityNotFoundException("Animal", animalId);
    }

    // 2. Fetch clinical health incidents
    const healthRecords = await this.prisma.healthRecord.findMany({
      where: { animalId },
      orderBy: { createdAt: "desc" },
      include: {
        recordedBy: { select: { id: true, name: true } },
        attendingVet: { select: { id: true, name: true } },
        attachments: {
          select: {
            id: true,
            fileName: true,
            mimeType: true,
            s3Key: true,
            caption: true,
          },
        },
      },
    });

    // 3. Fetch preventative vaccination and deworming records
    const vaccineRecords = await this.prisma.vaccineRecord.findMany({
      where: { animalId },
      orderBy: { administeredAt: "desc" },
      include: {
        recorder: { select: { id: true, name: true } },
      },
    });

    // 4. Fetch weight logs
    const weightLogs = await this.prisma.animalWeightLog.findMany({
      where: { animalId },
      orderBy: { recordedAt: "desc" },
      include: {
        recordedBy: { select: { id: true, name: true } },
      },
    });

    // 5. Fetch milk logs and anomalies for dairy species
    const isDairySpecies = [
      AnimalSpecies.COW,
      AnimalSpecies.BUFFALO,
      AnimalSpecies.GOAT,
      AnimalSpecies.SHEEP,
    ].includes(animal.species as AnimalSpecies);

    let milkProductionSummary: EhrMilkProductionSummaryDto | null = null;
    let lastYieldLiters: number | null = null;

    if (isDairySpecies) {
      const recentMilkLogs = await this.prisma.milkLog.findMany({
        where: { animalId },
        orderBy: { loggedDate: "desc" },
        take: 30,
      });

      const anomalies = await this.prisma.milkYieldAnomaly.findMany({
        where: { animalId },
        orderBy: { loggedDate: "desc" },
        take: 10,
      });

      if (recentMilkLogs.length > 0) {
        lastYieldLiters = Number(recentMilkLogs[0]!.yieldLiters);

        // Compute 7-day average
        const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
        const logs7d = recentMilkLogs.filter(
          (log) => new Date(log.loggedDate) >= sevenDaysAgo,
        );
        const avgYield7Days =
          logs7d.length > 0
            ? Math.round(
                (logs7d.reduce((sum, l) => sum + Number(l.yieldLiters), 0) /
                  logs7d.length) *
                  100,
              ) / 100
            : null;

        // Compute 30-day average
        const avgYield30Days =
          recentMilkLogs.length > 0
            ? Math.round(
                (recentMilkLogs.reduce(
                  (sum, l) => sum + Number(l.yieldLiters),
                  0,
                ) /
                  recentMilkLogs.length) *
                  100,
              ) / 100
            : null;

        milkProductionSummary = {
          recentLogs: recentMilkLogs.map((l) => ({
            id: l.id,
            session: l.session as MilkSession,
            yieldLiters: Number(l.yieldLiters),
            fatPercent: l.fatPercent ? Number(l.fatPercent) : null,
            snfPercent: l.snfPercent ? Number(l.snfPercent) : null,
            loggedDate: l.loggedDate.toISOString().slice(0, 10),
          })),
          avgYield7Days,
          avgYield30Days,
          anomalies: anomalies.map((a) => ({
            id: a.id,
            loggedDate: a.loggedDate.toISOString().slice(0, 10),
            currentYieldLiters: Number(a.currentYieldLiters),
            baselineYieldLiters: Number(a.baselineYieldLiters),
            dropPercentage: Number(a.dropPercentage),
            severity: a.severity as MilkAnomalySeverity,
            status: a.status as MilkAnomalyStatus,
            clinicalNotes: a.clinicalNotes,
          })),
        };
      }
    }

    // 6. Fetch past consultations
    const pastConsultations = await this.prisma.consultation.findMany({
      where: { animalId },
      orderBy: { createdAt: "desc" },
      include: {
        vet: { select: { id: true, name: true } },
      },
    });

    // 7. Fetch past prescriptions linked to this animal's consultations
    const prescriptions = await this.prisma.prescription.findMany({
      where: {
        consultation: {
          animalId,
        },
        signedAt: { not: null },
      },
      orderBy: { signedAt: "desc" },
      include: {
        vet: { select: { id: true, name: true } },
      },
    });

    // 8. Process active food safety drug withdrawal alerts
    const activeWithdrawalAlerts: EhrActiveWithdrawalAlertDto[] = [];
    for (const rx of prescriptions) {
      const medications = (rx.medications as any[]) ?? [];
      for (const med of medications) {
        const withdrawalDays = Number(med.withdrawalDays ?? 0);
        if (withdrawalDays > 0 && rx.signedAt) {
          const signedAtMs = new Date(rx.signedAt).getTime();
          const expiresAtMs = signedAtMs + withdrawalDays * 86400000;
          const isExpired = expiresAtMs <= now.getTime();
          const daysRemaining = isExpired
            ? 0
            : Math.ceil((expiresAtMs - now.getTime()) / 86400000);

          if (!isExpired) {
            activeWithdrawalAlerts.push({
              prescriptionId: rx.id,
              medicationName: med.name ?? "Prescribed Drug",
              withdrawalDays,
              withdrawalType: isDairySpecies ? "BOTH" : "MEAT",
              signedAt: rx.signedAt.toISOString(),
              expiresAt: new Date(expiresAtMs).toISOString(),
              daysRemaining,
              isExpired,
            });
          }
        }
      }
    }

    // 9. Format weight trajectory with deltas
    const weightHistory: EhrWeightRecordDto[] = [];
    for (let i = 0; i < weightLogs.length; i++) {
      const current = weightLogs[i]!;
      const currentWeight = Number(current.weightKg);
      let weightChangeKg: number | null = null;

      // If next log exists (which is chronologically older), compute change
      if (i + 1 < weightLogs.length) {
        const prevWeight = Number(weightLogs[i + 1]!.weightKg);
        weightChangeKg = Math.round((currentWeight - prevWeight) * 100) / 100;
      }

      weightHistory.push({
        id: current.id,
        weightKg: currentWeight,
        recordedAt: current.recordedAt.toISOString(),
        notes: current.notes,
        recordedBy: {
          id: current.recordedBy.id,
          name: current.recordedBy.name,
        },
        weightChangeKg,
      });
    }

    // 10. Format clinical incidents
    const clinicalIncidents: EhrClinicalIncidentDto[] = healthRecords.map(
      (hr) => ({
        id: hr.id,
        eventType: hr.eventType as HealthEventType,
        severity: hr.severity as SeverityLevel,
        symptoms: hr.symptoms,
        diagnosis: hr.diagnosis,
        treatment: hr.treatment,
        cost: Number(hr.cost),
        resolvedAt: hr.resolvedAt ? hr.resolvedAt.toISOString() : null,
        isResolved: hr.resolvedAt !== null,
        recordedBy: {
          id: hr.recordedBy.id,
          name: hr.recordedBy.name,
        },
        attendingVet: hr.attendingVet
          ? { id: hr.attendingVet.id, name: hr.attendingVet.name }
          : null,
        attachments: hr.attachments.map((att) => ({
          id: att.id,
          fileName: att.fileName,
          mimeType: att.mimeType,
          s3Key: att.s3Key,
          caption: att.caption,
        })),
        createdAt: hr.createdAt.toISOString(),
      }),
    );

    // 11. Format preventative records with overdue checks
    const preventativeRecords: EhrPreventativeRecordDto[] = vaccineRecords.map(
      (vr) => {
        const isOverdue =
          vr.nextDueDate !== null && new Date(vr.nextDueDate) < now;
        return {
          id: vr.id,
          recordType: vr.recordType as VaccineRecordType,
          vaccineName: vr.vaccineName,
          batchNumber: vr.batchNumber,
          doseAmount: Number(vr.doseAmount),
          doseUnit: vr.doseUnit,
          cost: Number(vr.cost),
          administeredAt: vr.administeredAt.toISOString(),
          nextDueDate: vr.nextDueDate
            ? vr.nextDueDate.toISOString().slice(0, 10)
            : null,
          isOverdue,
          administeredBy: {
            id: vr.recorder.id,
            name: vr.recorder.name,
          },
        };
      },
    );

    // 12. Calculate Highlights & KPIs
    const activeUnresolvedIncidents = clinicalIncidents.filter(
      (i) => !i.isResolved,
    ).length;
    const overduePreventativeCount = preventativeRecords.filter(
      (p) => p.isOverdue,
    ).length;
    const totalMedicalCost =
      healthRecords.reduce((sum, r) => sum + Number(r.cost), 0) +
      vaccineRecords.reduce((sum, r) => sum + Number(r.cost), 0);
    const lifetimeMedicalCostCents = Math.round(totalMedicalCost * 100);

    const lastWeightKg =
      weightHistory[0]?.weightKg ??
      (animal.weightKg ? Number(animal.weightKg) : null);

    const highlights: EhrClinicalHighlightsDto = {
      totalHealthIncidents: healthRecords.length,
      activeUnresolvedIncidents,
      totalVaccinationsAdministered: vaccineRecords.length,
      overduePreventativeCount,
      activeWithdrawalAlertsCount: activeWithdrawalAlerts.length,
      lifetimeMedicalCostCents,
      lastWeightKg,
      lastYieldLiters,
    };

    // 13. Animal summary with age calculation
    const ageFormatted = this.formatAge(animal.dateOfBirth, now);
    const animalSummary: EhrAnimalSummaryDto = {
      id: animal.id,
      farmId: animal.farmId,
      tagNumber: animal.tagNumber,
      rfidNumber: animal.rfidNumber,
      name: animal.name,
      species: animal.species as AnimalSpecies,
      breed: animal.breed,
      gender: animal.gender as AnimalGender,
      dateOfBirth: animal.dateOfBirth
        ? animal.dateOfBirth.toISOString().slice(0, 10)
        : null,
      ageFormatted,
      weightKg: animal.weightKg ? Number(animal.weightKg) : null,
      status: animal.status as AnimalStatus,
      sire: animal.sire,
      dam: animal.dam,
      farm: {
        id: animal.farm.id,
        name: animal.farm.name,
        farmType: animal.farm.farmType,
        country: animal.farm.country,
      },
    };

    // 14. Format consultation history
    const consultationHistory: EhrConsultationHistoryDto[] =
      pastConsultations.map((c) => ({
        id: c.id,
        type: c.type as ConsultationType,
        status: c.status as ConsultationStatus,
        chiefComplaint: c.chiefComplaint,
        vet: c.vet ? { id: c.vet.id, name: c.vet.name } : null,
        feeCents: c.feeCents,
        createdAt: c.createdAt.toISOString(),
      }));

    // 15. Format prescription history
    const prescriptionHistory: EhrPrescriptionHistoryDto[] = prescriptions.map(
      (rx) => ({
        id: rx.id,
        consultationId: rx.consultationId,
        diagnosis: rx.diagnosis,
        medications: (rx.medications as any[]) ?? [],
        pdfS3Key: rx.pdfS3Key ?? "",
        digitalSignatureHash: rx.digitalSignatureHash ?? "",
        signedAt: rx.signedAt
          ? rx.signedAt.toISOString()
          : rx.createdAt.toISOString(),
        vet: {
          id: rx.vet.id,
          name: rx.vet.name,
        },
      }),
    );

    // 16. Record audit log
    await this.auditLogRepo.record({
      userId: requestingUser.sub,
      action: "ANIMAL_EHR_VIEWED",
      entityType: "Animal",
      entityId: animalId,
      newValues: {
        consultationId: consultationId ?? null,
        viewerRole: requestingUser.role,
        highlights,
      },
      traceId: traceId ?? crypto.randomUUID(),
    });

    this.logger.log(
      `EHR viewed for animal '${animalId}' (tag: ${animal.tagNumber}) by user '${requestingUser.sub}' [role: ${requestingUser.role}]`,
    );

    return {
      animal: animalSummary,
      highlights,
      activeWithdrawalAlerts,
      clinicalIncidents,
      preventativeRecords,
      weightHistory,
      milkProduction: milkProductionSummary,
      consultationHistory,
      prescriptionHistory,
    };
  }

  private formatAge(dateOfBirth: Date | null, now: Date): string {
    if (!dateOfBirth) {
      return "Age Unknown";
    }

    const dob = new Date(dateOfBirth);
    const diffMs = now.getTime() - dob.getTime();
    if (diffMs < 0) {
      return "Newborn";
    }

    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays < 30) {
      return `${diffDays} day${diffDays === 1 ? "" : "s"}`;
    }

    const diffMonths = Math.floor(diffDays / 30.4375);
    if (diffMonths < 12) {
      return `${diffMonths} month${diffMonths === 1 ? "" : "s"}`;
    }

    const years = Math.floor(diffMonths / 12);
    const remainingMonths = diffMonths % 12;

    if (remainingMonths === 0) {
      return `${years} year${years === 1 ? "" : "s"}`;
    }

    return `${years} yr${years === 1 ? "" : "s"}, ${remainingMonths} mo`;
  }
}
