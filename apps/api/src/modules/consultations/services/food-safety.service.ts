import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import {
  AnimalSpecies,
  FarmWithdrawalAlertsDto,
  FoodSafetyRiskLevel,
  FoodSafetyWithdrawalStatusDto,
  JwtPayload,
  UserRole,
  WithdrawalAlertDispatchResultDto,
} from "@vetralink/shared-types";
import {
  EntityNotFoundException,
  ForbiddenOperationException,
} from "../../../common/exceptions/domain.exception";
import {
  AUDIT_LOG_REPOSITORY,
  IAuditLogRepository,
} from "../../audit/repositories/audit-log.repository.interface";
import {
  PUSH_NOTIFICATION_PROVIDER,
  SMS_NOTIFICATION_PROVIDER,
} from "../../clinical-health/providers/notification-provider.interface";
import {
  IPushNotificationProvider,
  ISmsNotificationProvider,
} from "../../clinical-health/providers/notification-provider.interface";
import {
  IMailService,
  MAIL_SERVICE,
} from "../../mail/interfaces/mail-service.interface";
import { PrismaService } from "../../prisma/prisma.service";
import {
  CONSULTATION_REPOSITORY,
  IConsultationRepository,
} from "../repositories/consultation.repository.interface";
import {
  IPrescriptionRepository,
  PRESCRIPTION_REPOSITORY,
} from "../repositories/prescription.repository.interface";
import { FoodSafetyEngine } from "../utils/food-safety-engine";
import { IFoodSafetyService } from "./food-safety.service.interface";

@Injectable()
export class FoodSafetyService implements IFoodSafetyService {
  private readonly logger = new Logger(FoodSafetyService.name);

  constructor(
    @Inject(CONSULTATION_REPOSITORY)
    private readonly consultationRepo: IConsultationRepository,
    @Inject(PRESCRIPTION_REPOSITORY)
    private readonly prescriptionRepo: IPrescriptionRepository,
    @Inject(AUDIT_LOG_REPOSITORY)
    private readonly auditLogRepo: IAuditLogRepository,
    private readonly prisma: PrismaService,
    @Inject(PUSH_NOTIFICATION_PROVIDER)
    private readonly pushProvider: IPushNotificationProvider,
    @Inject(SMS_NOTIFICATION_PROVIDER)
    private readonly smsProvider: ISmsNotificationProvider,
    @Optional()
    @Inject(MAIL_SERVICE)
    private readonly mailService?: IMailService,
  ) {}

  public async getConsultationWithdrawalStatus(
    consultationId: string,
    user: JwtPayload,
  ): Promise<FoodSafetyWithdrawalStatusDto> {
    const consultation = await this.consultationRepo.findById(consultationId);
    if (!consultation) {
      throw new EntityNotFoundException("Consultation", consultationId);
    }

    await this.verifyUserAccess(
      consultation.farmId,
      consultation.vetId ?? undefined,
      user,
    );

    if (!consultation.animalId) {
      throw new EntityNotFoundException(
        "Animal for consultation",
        consultationId,
      );
    }

    const animal = await this.prisma.animal.findUnique({
      where: { id: consultation.animalId },
    });
    if (!animal) {
      throw new EntityNotFoundException("Animal", consultation.animalId);
    }

    const prescription =
      await this.prescriptionRepo.findByConsultationId(consultationId);

    const prescriptions = prescription
      ? [
          {
            id: prescription.id,
            consultationId: prescription.consultationId,
            signedAt: prescription.signedAt,
            createdAt: prescription.createdAt,
            medications: prescription.medications,
          },
        ]
      : [];

    return FoodSafetyEngine.aggregateAnimalWithdrawalStatus({
      animalId: animal.id,
      animalTag: animal.tagNumber,
      animalName: animal.name ?? undefined,
      species: animal.species as AnimalSpecies,
      farmId: consultation.farmId,
      consultationId,
      prescriptionId: prescription?.id,
      prescriptions,
    });
  }

  public async getAnimalWithdrawalStatus(
    animalId: string,
    user: JwtPayload,
  ): Promise<FoodSafetyWithdrawalStatusDto> {
    const animal = await this.prisma.animal.findUnique({
      where: { id: animalId },
    });
    if (!animal) {
      throw new EntityNotFoundException("Animal", animalId);
    }

    await this.verifyUserAccess(animal.farmId, undefined, user);

    const rawPrescriptions = await this.prisma.prescription.findMany({
      where: {
        consultation: {
          animalId,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const prescriptions = rawPrescriptions.map((rx) => ({
      id: rx.id,
      consultationId: rx.consultationId,
      signedAt: rx.signedAt,
      createdAt: rx.createdAt,
      medications: (rx.medications as any[]) ?? [],
    }));

    return FoodSafetyEngine.aggregateAnimalWithdrawalStatus({
      animalId: animal.id,
      animalTag: animal.tagNumber,
      animalName: animal.name ?? undefined,
      species: animal.species as AnimalSpecies,
      farmId: animal.farmId,
      prescriptions,
    });
  }

  public async getFarmWithdrawalAlerts(
    farmId: string,
    user: JwtPayload,
  ): Promise<FarmWithdrawalAlertsDto> {
    await this.verifyUserAccess(farmId, undefined, user);

    const animals = await this.prisma.animal.findMany({
      where: { farmId, status: "ACTIVE" },
      select: {
        id: true,
        tagNumber: true,
        name: true,
        species: true,
        farmId: true,
      },
    });

    const rawPrescriptions = await this.prisma.prescription.findMany({
      where: {
        consultation: {
          farmId,
        },
      },
      include: {
        consultation: {
          select: {
            animalId: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const prescriptionsByAnimal = new Map<string, any[]>();
    for (const rx of rawPrescriptions) {
      const animalId = rx.consultation.animalId;
      if (!animalId) continue;
      const list = prescriptionsByAnimal.get(animalId) ?? [];
      list.push({
        id: rx.id,
        consultationId: rx.consultationId,
        signedAt: rx.signedAt,
        createdAt: rx.createdAt,
        medications: (rx.medications as any[]) ?? [],
      });
      prescriptionsByAnimal.set(animalId, list);
    }

    const activeAlerts: FoodSafetyWithdrawalStatusDto[] = [];

    for (const animal of animals) {
      const rxs = prescriptionsByAnimal.get(animal.id) ?? [];
      const status = FoodSafetyEngine.aggregateAnimalWithdrawalStatus({
        animalId: animal.id,
        animalTag: animal.tagNumber,
        animalName: animal.name ?? undefined,
        species: animal.species as AnimalSpecies,
        farmId: animal.farmId,
        prescriptions: rxs,
      });

      if (status.riskLevel !== FoodSafetyRiskLevel.SAFE) {
        activeAlerts.push(status);
      }
    }

    const animalsWithMilkWithdrawal = activeAlerts.filter(
      (a) => a.isMilkWithdrawn,
    ).length;
    const animalsWithMeatWithdrawal = activeAlerts.filter(
      (a) => a.isMeatWithdrawn,
    ).length;

    return {
      farmId,
      totalAnimalsUnderWithdrawal: activeAlerts.length,
      animalsWithMilkWithdrawal,
      animalsWithMeatWithdrawal,
      alerts: activeAlerts,
    };
  }

  public async dispatchWithdrawalAlert(
    consultationId: string,
    author: JwtPayload,
    traceId?: string,
  ): Promise<WithdrawalAlertDispatchResultDto> {
    const consultation = await this.consultationRepo.findById(consultationId);
    if (!consultation) {
      throw new EntityNotFoundException("Consultation", consultationId);
    }

    const isAdmin =
      author.role === UserRole.ADMIN || author.role === UserRole.SUPER_ADMIN;
    const isAssignedVet =
      author.role === UserRole.VET && consultation.vetId === author.sub;

    if (!isAdmin && !isAssignedVet) {
      throw new ForbiddenOperationException(
        "Only the assigned veterinarian or an administrator can dispatch food safety withdrawal alerts.",
      );
    }

    const prescription =
      await this.prescriptionRepo.findByConsultationId(consultationId);
    if (!prescription) {
      throw new EntityNotFoundException(
        "Prescription for consultation",
        consultationId,
      );
    }

    if (!consultation.animalId) {
      throw new EntityNotFoundException(
        "Animal for consultation",
        consultationId,
      );
    }

    const animal = await this.prisma.animal.findUnique({
      where: { id: consultation.animalId },
    });
    if (!animal) {
      throw new EntityNotFoundException("Animal", consultation.animalId);
    }

    const status = FoodSafetyEngine.aggregateAnimalWithdrawalStatus({
      animalId: animal.id,
      animalTag: animal.tagNumber,
      animalName: animal.name ?? undefined,
      species: animal.species as AnimalSpecies,
      farmId: consultation.farmId,
      consultationId,
      prescriptionId: prescription.id,
      prescriptions: [
        {
          id: prescription.id,
          consultationId: prescription.consultationId,
          signedAt: prescription.signedAt,
          createdAt: prescription.createdAt,
          medications: prescription.medications,
        },
      ],
    });

    const notificationsSent = {
      push: false,
      sms: false,
      email: false,
    };

    if (status.riskLevel !== FoodSafetyRiskLevel.SAFE) {
      const farmer = await this.prisma.user.findUnique({
        where: { id: consultation.farmerId },
        select: { id: true, email: true, phone: true, name: true },
      });

      if (farmer) {
        const title = `⚠️ FOOD SAFETY ALERT: ${animal.tagNumber} Drug Withdrawal`;
        const body =
          status.warningMessage ??
          `Animal '${animal.tagNumber}' is under active drug withdrawal. Please review medication restrictions immediately.`;

        // 1. Push Notification
        try {
          await this.pushProvider.sendPush({
            userId: farmer.id,
            title,
            body,
            data: {
              type: "FOOD_SAFETY_ALERT",
              consultationId,
              animalId: animal.id,
              riskLevel: status.riskLevel,
            },
          });
          notificationsSent.push = true;
        } catch (error) {
          this.logger.warn(
            `Failed to send push notification to farmer '${farmer.id}': ${error}`,
          );
        }

        // 2. SMS Notification
        if (farmer.phone) {
          try {
            await this.smsProvider.sendSms({
              to: farmer.phone,
              body: `${title}\n${body}`,
            });
            notificationsSent.sms = true;
          } catch (error) {
            this.logger.warn(
              `Failed to send SMS to farmer '${farmer.id}': ${error}`,
            );
          }
        }

        // 3. Email Notification
        if (this.mailService && farmer.email) {
          try {
            await this.mailService.sendEmail({
              to: farmer.email,
              subject: title,
              text: `${title}\n\n${body}\n\nPlease ensure milk is not added to bulk tanks and the animal is not slaughtered until clearance.`,
              html: `<h2>Food Safety Drug Withdrawal Warning</h2>
                     <p>Dear ${farmer.name ?? "Farmer"},</p>
                     <p><strong>Animal Tag:</strong> ${animal.tagNumber}</p>
                     <p><strong>Risk Level:</strong> ${status.riskLevel}</p>
                     <p><strong>Details:</strong> ${body}</p>
                     <p>Please ensure milk is not added to bulk tanks and the animal is not slaughtered until clearance.</p>`,
            });
            notificationsSent.email = true;
          } catch (error) {
            this.logger.warn(
              `Failed to send email to farmer '${farmer.id}': ${error}`,
            );
          }
        }
      }

      await this.auditLogRepo.record({
        userId: author.sub,
        action: "FOOD_SAFETY_ALERT_DISPATCHED",
        entityType: "Consultation",
        entityId: consultationId,
        traceId: traceId ?? `trace-${Date.now()}`,
        newValues: {
          animalId: animal.id,
          animalTag: animal.tagNumber,
          riskLevel: status.riskLevel,
          notificationsSent,
        },
      });

      this.logger.log(
        `Dispatched food safety withdrawal alert for animal '${animal.tagNumber}' on consultation '${consultationId}' (risk: ${status.riskLevel})`,
      );
    }

    return {
      consultationId,
      animalId: animal.id,
      farmerId: consultation.farmerId,
      riskLevel: status.riskLevel,
      notificationsSent,
      dispatchedAt: new Date().toISOString(),
    };
  }

  private async verifyUserAccess(
    farmId: string,
    vetId: string | undefined,
    user: JwtPayload,
  ): Promise<void> {
    if (user.role === UserRole.SUPER_ADMIN || user.role === UserRole.ADMIN) {
      return;
    }

    if (user.role === UserRole.VET) {
      if (vetId && vetId === user.sub) {
        return;
      }
      // Vets may also be associated with the farm as clinic staff
      const membership = await this.prisma.farmMember.findUnique({
        where: {
          farmId_userId: {
            farmId,
            userId: user.sub,
          },
        },
      });
      if (membership) {
        return;
      }
      // If not attending vet and not farm staff, allow vet to view clinical status if consultation exists
      return;
    }

    if (user.role === UserRole.FARMER) {
      const membership = await this.prisma.farmMember.findUnique({
        where: {
          farmId_userId: {
            farmId,
            userId: user.sub,
          },
        },
      });
      if (!membership) {
        throw new ForbiddenOperationException(
          "You do not have permission to view food safety records for this farm.",
        );
      }
      return;
    }

    throw new ForbiddenOperationException(
      "Insufficient permissions to view food safety data.",
    );
  }
}
