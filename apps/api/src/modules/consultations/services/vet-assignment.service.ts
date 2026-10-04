import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import {
  AssignConsultationDto,
  AutoAssignConsultationDto,
  ConsultationResponseDto,
  ConsultationStatus,
  ConsultationType,
  UpdateVetProfileDto,
  UserRole,
  VetAvailabilitySummaryDto,
  VetCandidateDto,
  VetProfileDto,
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
import { VetProfileEntity } from "../entities/vet-profile.entity";
import {
  CONSULTATION_REPOSITORY,
  IConsultationRepository,
} from "../repositories/consultation.repository.interface";
import {
  IVetProfileRepository,
  VET_PROFILE_REPOSITORY,
} from "../repositories/vet-profile.repository.interface";
import {
  CONSULTATION_NOTIFICATION_SERVICE,
  IConsultationNotificationService,
} from "./consultation-notification.service.interface";
import { IVetAssignmentService } from "./vet-assignment.service.interface";

@Injectable()
export class VetAssignmentService implements IVetAssignmentService {
  private readonly logger = new Logger(VetAssignmentService.name);

  constructor(
    @Inject(CONSULTATION_REPOSITORY)
    private readonly consultationRepo: IConsultationRepository,
    @Inject(VET_PROFILE_REPOSITORY)
    private readonly vetProfileRepo: IVetProfileRepository,
    @Inject(AUDIT_LOG_REPOSITORY)
    private readonly auditLogRepo: IAuditLogRepository,
    private readonly prisma: PrismaService,
    @Optional()
    @Inject(CONSULTATION_NOTIFICATION_SERVICE)
    private readonly notificationService?: IConsultationNotificationService,
  ) {}

  public async getRankedCandidates(
    consultationId: string,
  ): Promise<VetCandidateDto[]> {
    const consultation = await this.consultationRepo.findById(consultationId);
    if (!consultation) {
      throw new EntityNotFoundException("Consultation", consultationId);
    }

    const activeVets = await this.vetProfileRepo.findAllActiveVetsWithProfiles();
    const candidateResults: VetCandidateDto[] = [];

    const targetSpecies = consultation.animal?.species ?? null;
    const scheduledTime = consultation.scheduledAt;

    for (const vetRecord of activeVets) {
      const { user } = vetRecord;
      let profile = vetRecord.profile;

      if (!profile) {
        profile = VetProfileEntity.create({
          userId: user.id,
          isAvailable: true,
          maxActiveCases: 5,
          specialties: [],
          workingHours: [],
        });
      }

      const activeCases =
        await this.consultationRepo.countActiveConsultationsByVet(user.id);

      // Check eligibility
      let isEligible = true;
      let ineligibilityReason: string | undefined;

      if (!profile.isAvailable) {
        isEligible = false;
        ineligibilityReason = "Veterinarian is currently off-duty/unavailable.";
      } else if (!profile.canAcceptMoreCases(activeCases)) {
        isEligible = false;
        ineligibilityReason = `Veterinarian is at maximum active capacity (${activeCases}/${profile.maxActiveCases}).`;
      } else if (
        consultation.type === ConsultationType.LIVE_VIDEO &&
        scheduledTime
      ) {
        if (!profile.isAvailableAt(scheduledTime)) {
          isEligible = false;
          ineligibilityReason = "Scheduled appointment time falls outside working hours.";
        } else {
          const conflicts =
            await this.consultationRepo.findConflictingConsultations(
              user.id,
              scheduledTime,
              45,
            );
          if (conflicts.length > 0) {
            isEligible = false;
            ineligibilityReason =
              "Veterinarian has a conflicting consultation session at this time.";
          }
        }
      }

      // Compute match score
      const specialtyMatch = profile.matchesSpecialty(targetSpecies);
      let specialtyScore = 0;
      if (specialtyMatch.isExact) {
        specialtyScore = 50;
      } else if (specialtyMatch.matches) {
        specialtyScore = 25;
      }

      // Workload score (0 - 30): lower active cases gives higher score
      const loadFactor = activeCases / profile.maxActiveCases;
      const workloadScore = Math.max(0, Math.round((1 - loadFactor) * 30));

      // Availability / responsiveness score (0 - 20)
      let availabilityScore = 0;
      if (profile.isAvailable && activeCases === 0) {
        availabilityScore = 20;
      } else if (profile.isAvailable && activeCases <= 2) {
        availabilityScore = 10;
      }

      const totalScore = isEligible
        ? specialtyScore + workloadScore + availabilityScore
        : 0;

      candidateResults.push({
        vetId: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        specialties: profile.specialties,
        isAvailable: profile.isAvailable,
        currentActiveCases: activeCases,
        maxActiveCases: profile.maxActiveCases,
        totalScore,
        scoreBreakdown: {
          specialtyScore,
          workloadScore,
          availabilityScore,
        },
        isEligible,
        ineligibilityReason,
      });
    }

    // Sort: eligible candidates first by totalScore desc, then by currentActiveCases asc
    candidateResults.sort((a, b) => {
      if (a.isEligible && !b.isEligible) return -1;
      if (!a.isEligible && b.isEligible) return 1;
      if (b.totalScore !== a.totalScore) {
        return b.totalScore - a.totalScore;
      }
      return a.currentActiveCases - b.currentActiveCases;
    });

    return candidateResults;
  }

  public async assignToVet(
    consultationId: string,
    dto: AssignConsultationDto,
    assignedByUserId: string,
    traceId?: string,
  ): Promise<ConsultationResponseDto> {
    const consultation = await this.consultationRepo.findById(consultationId);
    if (!consultation) {
      throw new EntityNotFoundException("Consultation", consultationId);
    }

    if (!consultation.canBeAssigned()) {
      throw new ValidationDomainException(
        `Cannot assign consultation in status '${consultation.status}'. Allowed statuses: [SUBMITTED, ASSIGNED].`,
      );
    }

    // Verify target vet exists and has VET role
    const vetUser = await this.prisma.user.findUnique({
      where: { id: dto.vetId },
    });
    if (!vetUser || vetUser.role !== UserRole.VET || vetUser.deletedAt !== null) {
      throw new ValidationDomainException(
        `User '${dto.vetId}' is not an active veterinarian.`,
      );
    }

    const scheduledDate = dto.scheduledAt ? new Date(dto.scheduledAt) : null;
    const oldStatus = consultation.status;
    const oldVetId = consultation.vetId;

    consultation.assignToVet(dto.vetId, scheduledDate);

    const updated = await this.consultationRepo.save(consultation);

    await this.auditLogRepo.record({
      userId: assignedByUserId,
      action: "CONSULTATION_MANUALLY_ASSIGNED",
      entityType: "Consultation",
      entityId: updated.id,
      oldValues: {
        status: oldStatus,
        vetId: oldVetId,
      },
      newValues: {
        status: updated.status,
        vetId: updated.vetId,
        scheduledAt: updated.scheduledAt ? updated.scheduledAt.toISOString() : null,
        assignedAt: updated.assignedAt ? updated.assignedAt.toISOString() : null,
        notes: dto.notes ?? null,
      },
      traceId: traceId ?? crypto.randomUUID(),
    });

    this.logger.log(
      `Consultation '${updated.id}' manually assigned to vet '${dto.vetId}' by user '${assignedByUserId}'`,
    );

    if (this.notificationService) {
      try {
        await this.notificationService.dispatchAssignmentNotification(
          updated.id,
          dto.vetId,
          {
            customNote: dto.notes,
            traceId,
          },
        );
      } catch (notifErr: unknown) {
        const notifMsg =
          notifErr instanceof Error ? notifErr.message : String(notifErr);
        this.logger.error(
          `Failed to dispatch real-time assignment notification for consultation '${updated.id}' to vet '${dto.vetId}': ${notifMsg}`,
        );
      }
    }

    return updated.toResponseDto();
  }

  public async autoAssign(
    consultationId: string,
    dto: AutoAssignConsultationDto,
    assignedByUserId: string,
    traceId?: string,
  ): Promise<ConsultationResponseDto> {
    const candidates = await this.getRankedCandidates(consultationId);
    const eligibleCandidates = candidates.filter((c) => c.isEligible);

    if (eligibleCandidates.length === 0) {
      throw new ValidationDomainException(
        "No eligible veterinarians available to auto-assign for this consultation. Please review availability or assign manually.",
      );
    }

    const selectedVet = eligibleCandidates[0]!;

    return this.assignToVet(
      consultationId,
      {
        vetId: selectedVet.vetId,
        scheduledAt: dto.scheduledAt,
        notes: `Auto-assigned based on match score: ${selectedVet.totalScore}/100`,
      },
      assignedByUserId,
      traceId,
    );
  }

  public async getVetAvailabilityList(): Promise<VetAvailabilitySummaryDto[]> {
    const activeVets = await this.vetProfileRepo.findAllActiveVetsWithProfiles();
    const results: VetAvailabilitySummaryDto[] = [];

    for (const { user, profile } of activeVets) {
      const activeCases =
        await this.consultationRepo.countActiveConsultationsByVet(user.id);
      const maxCases = profile?.maxActiveCases ?? 5;
      const isAvailable = profile?.isAvailable ?? true;
      const specialties = profile?.specialties ?? [];
      const timezone = profile?.timezone ?? "UTC";
      const capacityUtilizationPercent = Math.round((activeCases / maxCases) * 100);

      results.push({
        vetId: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        isAvailable,
        specialties,
        currentActiveCases: activeCases,
        maxActiveCases: maxCases,
        capacityUtilizationPercent,
        timezone,
      });
    }

    return results;
  }

  public async getVetProfile(vetId: string): Promise<VetProfileDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: vetId },
      include: { vetProfile: true },
    });

    if (!user || user.role !== UserRole.VET) {
      throw new EntityNotFoundException("Veterinarian", vetId);
    }

    if (!user.vetProfile) {
      const defaultEntity = VetProfileEntity.create({
        userId: user.id,
        isAvailable: true,
        maxActiveCases: 5,
        specialties: [],
        workingHours: [],
        timezone: "UTC",
      });
      return defaultEntity.toDto();
    }

    return VetProfileEntity.fromPersistence({
      ...user.vetProfile,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
      },
    }).toDto();
  }

  public async updateVetProfile(
    vetId: string,
    dto: UpdateVetProfileDto,
    requestingUserId: string,
    requestingRole: UserRole,
    traceId?: string,
  ): Promise<VetProfileDto> {
    // Only the vet themselves or an administrator can update their profile
    if (
      requestingUserId !== vetId &&
      requestingRole !== UserRole.ADMIN &&
      requestingRole !== UserRole.SUPER_ADMIN
    ) {
      throw new ForbiddenOperationException(
        "You do not have permission to update this veterinarian's availability profile.",
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: vetId },
    });
    if (!user || user.role !== UserRole.VET) {
      throw new EntityNotFoundException("Veterinarian", vetId);
    }

    let profile = await this.vetProfileRepo.findByUserId(vetId);
    if (!profile) {
      profile = VetProfileEntity.create({
        userId: vetId,
        specialties: dto.specialties ?? [],
        isAvailable: dto.isAvailable ?? true,
        maxActiveCases: dto.maxActiveCases ?? 5,
        workingHours: dto.workingHours ?? [],
        timezone: dto.timezone ?? "UTC",
      });
    } else {
      profile.update({
        specialties: dto.specialties,
        isAvailable: dto.isAvailable,
        maxActiveCases: dto.maxActiveCases,
        workingHours: dto.workingHours,
        timezone: dto.timezone,
      });
    }

    const saved = await this.vetProfileRepo.save(profile);

    await this.auditLogRepo.record({
      userId: requestingUserId,
      action: "VET_PROFILE_UPDATED",
      entityType: "VetProfile",
      entityId: saved.id,
      newValues: {
        vetId,
        isAvailable: saved.isAvailable,
        maxActiveCases: saved.maxActiveCases,
        specialties: saved.specialties,
      },
      traceId: traceId ?? crypto.randomUUID(),
    });

    this.logger.log(
      `VetProfile for '${vetId}' updated successfully by user '${requestingUserId}'`,
    );

    return saved.toDto();
  }
}
