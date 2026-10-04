import { Inject, Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  CanonicalPrescriptionPayload,
  CreatePrescriptionDto,
  HealthEventType,
  JwtPayload,
  PrescriptionDto,
  PrescriptionStatus,
  PublicPrescriptionVerificationDto,
  SeverityLevel,
  SignPrescriptionDto,
  SignatureVerificationResultDto,
  StructuredMedicationItemDto,
  UpdatePrescriptionDto,
  UserRole,
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
import { PrescriptionEntity } from "../entities/prescription.entity";
import { VetProfileEntity } from "../entities/vet-profile.entity";
import {
  IPrescriptionRepository,
  PRESCRIPTION_REPOSITORY,
} from "../repositories/prescription.repository.interface";
import {
  CONSULTATION_REPOSITORY,
  IConsultationRepository,
} from "../repositories/consultation.repository.interface";
import {
  IVetProfileRepository,
  VET_PROFILE_REPOSITORY,
} from "../repositories/vet-profile.repository.interface";
import {
  IPkiCryptoService,
  PKI_CRYPTO_SERVICE,
} from "../../../common/crypto/pki-crypto.service.interface";
import {
  IPrescriptionPdfService,
  PRESCRIPTION_PDF_SERVICE,
} from "./prescription-pdf.service.interface";
import {
  IS3StorageService,
  S3_STORAGE_SERVICE,
} from "../../media/services/s3-storage.service.interface";
import { EnvService } from "../../../config/env.service";
import { IPrescriptionService } from "./prescription.service.interface";

@Injectable()
export class PrescriptionService implements IPrescriptionService {
  private readonly logger = new Logger(PrescriptionService.name);

  constructor(
    @Inject(CONSULTATION_REPOSITORY)
    private readonly consultationRepo: IConsultationRepository,
    @Inject(PRESCRIPTION_REPOSITORY)
    private readonly prescriptionRepo: IPrescriptionRepository,
    @Inject(VET_PROFILE_REPOSITORY)
    private readonly vetProfileRepo: IVetProfileRepository,
    @Inject(PKI_CRYPTO_SERVICE)
    private readonly pkiCryptoService: IPkiCryptoService,
    @Inject(PRESCRIPTION_PDF_SERVICE)
    private readonly prescriptionPdfService: IPrescriptionPdfService,
    @Inject(S3_STORAGE_SERVICE)
    private readonly s3StorageService: IS3StorageService,
    @Inject(AUDIT_LOG_REPOSITORY)
    private readonly auditLogRepo: IAuditLogRepository,
    private readonly prisma: PrismaService,
    private readonly envService: EnvService,
  ) {}

  public async createPrescription(
    consultationId: string,
    author: JwtPayload,
    dto: CreatePrescriptionDto,
    traceId?: string,
  ): Promise<PrescriptionDto> {
    const consultation = await this.consultationRepo.findById(consultationId);
    if (!consultation) {
      throw new EntityNotFoundException("Consultation", consultationId);
    }

    this.verifyDoctorWriteAccess(consultation, author);

    const existing =
      await this.prescriptionRepo.findByConsultationId(consultationId);
    if (existing) {
      throw new ValidationDomainException(
        "A prescription already exists for this consultation. Please update the draft or revoke it.",
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: author.sub },
      select: { name: true },
    });

    const entity = PrescriptionEntity.create({
      consultationId,
      vetId: author.sub,
      diagnosis: dto.diagnosis,
      notes: dto.notes,
      medications: dto.medications,
      vetName: user?.name,
    });

    const saved = await this.prescriptionRepo.create(entity);

    await this.auditLogRepo.record({
      userId: author.sub,
      action: "PRESCRIPTION_DRAFTED",
      entityType: "Prescription",
      entityId: saved.id,
      newValues: {
        consultationId,
        diagnosis: saved.diagnosis,
        medicationCount: saved.medications.length,
        status: saved.status,
      },
      traceId: traceId ?? crypto.randomUUID(),
    });

    this.logger.log(
      `Prescription '${saved.id}' drafted for consultation '${consultationId}' by vet '${author.sub}'`,
    );

    return saved.toDto();
  }

  public async getPrescription(
    consultationId: string,
    requestingUser: JwtPayload,
  ): Promise<PrescriptionDto | null> {
    const consultation = await this.consultationRepo.findById(consultationId);
    if (!consultation) {
      throw new EntityNotFoundException("Consultation", consultationId);
    }

    await this.verifyReadAccess(consultation, requestingUser);

    const prescription =
      await this.prescriptionRepo.findByConsultationId(consultationId);
    if (!prescription) {
      return null;
    }

    const isFarmer =
      requestingUser.role === UserRole.FARMER ||
      requestingUser.role === UserRole.BUYER;

    // Farmers are not permitted to see unfinalized draft prescriptions
    if (isFarmer && prescription.status === PrescriptionStatus.DRAFT) {
      return null;
    }

    return prescription.toDto();
  }

  public async updatePrescription(
    consultationId: string,
    author: JwtPayload,
    dto: UpdatePrescriptionDto,
    traceId?: string,
  ): Promise<PrescriptionDto> {
    const consultation = await this.consultationRepo.findById(consultationId);
    if (!consultation) {
      throw new EntityNotFoundException("Consultation", consultationId);
    }

    this.verifyDoctorWriteAccess(consultation, author);

    const prescription =
      await this.prescriptionRepo.findByConsultationId(consultationId);
    if (!prescription) {
      throw new EntityNotFoundException("Prescription", consultationId);
    }

    prescription.update(dto);
    const updated = await this.prescriptionRepo.save(prescription);

    await this.auditLogRepo.record({
      userId: author.sub,
      action: "PRESCRIPTION_UPDATED",
      entityType: "Prescription",
      entityId: updated.id,
      newValues: {
        diagnosis: updated.diagnosis,
        notes: updated.notes,
        medicationCount: updated.medications.length,
        status: updated.status,
        updatedAt: updated.updatedAt.toISOString(),
      },
      traceId: traceId ?? crypto.randomUUID(),
    });

    this.logger.log(
      `Prescription '${updated.id}' updated for consultation '${consultationId}' by vet '${author.sub}'`,
    );

    return updated.toDto();
  }

  public async signPrescription(
    consultationId: string,
    author: JwtPayload,
    dto?: SignPrescriptionDto,
    traceId?: string,
  ): Promise<PrescriptionDto> {
    const consultation = await this.consultationRepo.findById(consultationId);
    if (!consultation) {
      throw new EntityNotFoundException("Consultation", consultationId);
    }

    this.verifyDoctorWriteAccess(consultation, author);

    const prescription =
      await this.prescriptionRepo.findByConsultationId(consultationId);
    if (!prescription) {
      throw new EntityNotFoundException("Prescription", consultationId);
    }

    if (prescription.status !== PrescriptionStatus.DRAFT) {
      throw new ValidationDomainException(
        `Only prescriptions in DRAFT status can be signed. Current status is ${prescription.status}.`,
      );
    }

    const vetId = consultation.vetId ?? author.sub;
    let vetProfile = await this.vetProfileRepo.findByUserId(vetId);

    if (dto?.licenseNumber && dto.licenseNumber.trim() !== "") {
      if (!vetProfile) {
        vetProfile = VetProfileEntity.create({
          userId: vetId,
          licenseNumber: dto.licenseNumber.trim(),
        });
        await this.vetProfileRepo.save(vetProfile);
      } else if (vetProfile.licenseNumber !== dto.licenseNumber.trim()) {
        vetProfile.update({ licenseNumber: dto.licenseNumber.trim() });
        await this.vetProfileRepo.save(vetProfile);
      }
    }

    const licenseNumber =
      vetProfile?.licenseNumber ||
      dto?.licenseNumber?.trim() ||
      "UNREGISTERED-VET";

    const vetUser = await this.prisma.user.findUnique({
      where: { id: vetId },
      select: { name: true },
    });
    const vetName =
      vetUser?.name || prescription.vetName || "Attending Veterinarian";

    const animalId = consultation.animalId ?? "UNSPECIFIED";
    const animalTag = consultation.animal?.tagNumber ?? "HERD-GENERAL";

    const signDate = new Date();
    const signedAtIso = signDate.toISOString();

    const canonicalPayload: CanonicalPrescriptionPayload = {
      prescriptionId: prescription.id,
      consultationId,
      vetId,
      vetName,
      vetLicenseNumber: licenseNumber,
      animalId,
      animalTag,
      farmId: consultation.farmId,
      diagnosis: prescription.diagnosis,
      notes: prescription.notes,
      medications: prescription.medications,
      withdrawalDays: prescription.withdrawalDays,
      signedAt: signedAtIso,
    };

    const canonicalString = this.pkiCryptoService.canonicalize(
      canonicalPayload as unknown as Record<string, unknown>,
    );
    const digitalSignature = this.pkiCryptoService.sign(canonicalString);

    // Dynamic PDF Generation & S3 Storage
    const verifyUrl = `${this.envService.corsOrigins?.[0] || "https://app.vetralink.com"}/verify/prescription/${consultationId}`;
    const farmName = consultation.farm?.name || "Farm Client";
    const farmerName = consultation.farmer?.name || "Farmer Client";
    const animalSpecies = consultation.animal?.species || "Livestock";
    const animalName = consultation.animal?.name || undefined;

    let s3Key: string | null = null;
    try {
      const pdfBuffer = await this.prescriptionPdfService.generatePrescriptionPdf({
        prescriptionId: prescription.id,
        consultationId,
        vetName,
        vetLicenseNumber: licenseNumber,
        farmName,
        farmerName,
        animalTag,
        animalName,
        animalSpecies,
        diagnosis: prescription.diagnosis,
        notes: prescription.notes,
        medications: prescription.medications,
        withdrawalDays: prescription.withdrawalDays,
        digitalSignatureHash: digitalSignature,
        signedAt: signedAtIso,
        verifyUrl,
      });

      s3Key = `prescriptions/${consultationId}/prescription-${prescription.id}.pdf`;
      const bucket = this.envService.s3BucketMedia || "vetralink-prescriptions";

      if (this.s3StorageService.uploadBuffer) {
        await this.s3StorageService.uploadBuffer(
          bucket,
          s3Key,
          pdfBuffer,
          "application/pdf",
        );
      }
    } catch (err) {
      this.logger.warn(
        `Failed to generate/upload prescription PDF for consultation '${consultationId}': ${err}`,
      );
    }

    prescription.sign(digitalSignature, s3Key ?? undefined, signDate);
    const saved = await this.prescriptionRepo.save(prescription);

    await this.auditLogRepo.record({
      userId: author.sub,
      action: "PRESCRIPTION_DIGITALLY_SIGNED",
      entityType: "Prescription",
      entityId: saved.id,
      newValues: {
        consultationId,
        digitalSignatureHash: digitalSignature,
        signedAt: saved.signedAt?.toISOString(),
        vetLicenseNumber: licenseNumber,
        pdfS3Key: s3Key,
      },
      traceId: traceId ?? crypto.randomUUID(),
    });

    this.logger.log(
      `Prescription '${saved.id}' digitally signed (RSA-SHA256) by vet '${vetId}' (License: ${licenseNumber})`,
    );

    // Automatic append of prescription into animal's permanent EHR record
    if (consultation.animalId) {
      try {
        const treatmentText = this.formatMedicationsForEhr(
          saved.id,
          consultationId,
          saved.medications,
          saved.notes,
        );

        const symptomsText =
          consultation.chiefComplaint &&
          consultation.chiefComplaint.trim().length >= 3
            ? consultation.chiefComplaint.trim()
            : `Prescription issued for ${saved.diagnosis}`;

        const costDecimal = new Prisma.Decimal(
          consultation.feeCents ? consultation.feeCents / 100 : 0,
        );

        // Check for existing HealthRecord linked to this consultation for idempotency
        const existingHealthRecord = await this.prisma.healthRecord.findFirst({
          where: {
            animalId: consultation.animalId,
            treatment: {
              contains: `Consultation #${consultationId}`,
            },
          },
        });

        let healthRecordId: string;

        if (existingHealthRecord) {
          const updated = await this.prisma.healthRecord.update({
            where: { id: existingHealthRecord.id },
            data: {
              diagnosis: saved.diagnosis,
              treatment: treatmentText,
              attendingVetId: vetId,
              cost: costDecimal,
              updatedAt: signDate,
            },
          });
          healthRecordId = updated.id;
        } else {
          const created = await this.prisma.healthRecord.create({
            data: {
              farmId: consultation.farmId,
              animalId: consultation.animalId,
              recordedById: author.sub,
              attendingVetId: vetId,
              eventType: HealthEventType.ILLNESS,
              severity: SeverityLevel.MEDIUM,
              symptoms: symptomsText,
              diagnosis: saved.diagnosis,
              treatment: treatmentText,
              cost: costDecimal,
              resolvedAt: null, // Active under medication treatment regimen
              escalationLevel: 0,
              syncVersion: 1,
              createdAt: signDate,
              updatedAt: signDate,
            },
          });
          healthRecordId = created.id;
        }

        await this.auditLogRepo.record({
          userId: author.sub,
          action: "PRESCRIPTION_EHR_APPENDED",
          entityType: "HealthRecord",
          entityId: healthRecordId,
          newValues: {
            consultationId,
            prescriptionId: saved.id,
            animalId: consultation.animalId,
            diagnosis: saved.diagnosis,
            treatment: treatmentText,
            cost: Number(costDecimal),
          },
          traceId: traceId ?? crypto.randomUUID(),
        });

        this.logger.log(
          `Prescription '${saved.id}' automatically appended to animal '${consultation.animalId}' EHR (HealthRecord: '${healthRecordId}')`,
        );
      } catch (ehrErr) {
        this.logger.error(
          `Failed to append prescription '${saved.id}' to animal EHR: ${ehrErr}`,
        );
      }
    } else {
      this.logger.log(
        `Consultation '${consultationId}' has no animalId; skipping individual animal EHR append.`,
      );
    }

    return saved.toDto();
  }

  private formatMedicationsForEhr(
    prescriptionId: string,
    consultationId: string,
    medications: StructuredMedicationItemDto[],
    notes?: string | null,
  ): string {
    const medicationLines = (medications || []).map((med) => {
      const durationStr = med.durationDays
        ? `${med.durationDays} days`
        : "as prescribed";
      let line = `- ${med.name} [${med.formulation}] (${med.dosage}, ${med.frequency} for ${durationStr})`;
      if (med.route) line += ` - Route: ${med.route}`;
      if (med.withdrawalDays && Number(med.withdrawalDays) > 0) {
        line += ` [Withdrawal: ${med.withdrawalDays}d]`;
      } else if (med.withdrawalDaysMilk || med.withdrawalDaysMeat) {
        const parts: string[] = [];
        if (med.withdrawalDaysMilk) parts.push(`Milk: ${med.withdrawalDaysMilk}d`);
        if (med.withdrawalDaysMeat) parts.push(`Meat: ${med.withdrawalDaysMeat}d`);
        line += ` [Withdrawal: ${parts.join(", ")}]`;
      }
      if (med.instructions) line += ` - Instructions: ${med.instructions}`;
      return line;
    });

    const parts = [
      `Prescription #${prescriptionId} (Consultation #${consultationId}):`,
      ...medicationLines,
    ];

    if (notes && notes.trim() !== "") {
      parts.push(`Clinical Notes: ${notes.trim()}`);
    }

    return parts.join("\n");
  }

  public async getPrescriptionPdf(
    consultationId: string,
    requestingUser: JwtPayload,
  ): Promise<{ buffer: Buffer; fileName: string; s3Key?: string | null }> {
    const consultation = await this.consultationRepo.findById(consultationId);
    if (!consultation) {
      throw new EntityNotFoundException("Consultation", consultationId);
    }

    await this.verifyReadAccess(consultation, requestingUser);

    const prescription =
      await this.prescriptionRepo.findByConsultationId(consultationId);
    if (!prescription) {
      throw new EntityNotFoundException("Prescription", consultationId);
    }

    if (
      prescription.status !== PrescriptionStatus.SIGNED ||
      !prescription.digitalSignatureHash ||
      !prescription.signedAt
    ) {
      throw new ValidationDomainException(
        "Prescription PDF cannot be retrieved until it is officially signed.",
      );
    }

    const vetId = consultation.vetId ?? prescription.vetId;
    const vetProfile = await this.vetProfileRepo.findByUserId(vetId);
    const vetUser = await this.prisma.user.findUnique({
      where: { id: vetId },
      select: { name: true },
    });

    const licenseNumber = vetProfile?.licenseNumber || "UNREGISTERED-VET";
    const vetName =
      vetUser?.name || prescription.vetName || "Attending Veterinarian";
    const animalId = consultation.animalId ?? "UNSPECIFIED";
    const animalTag = consultation.animal?.tagNumber ?? "HERD-GENERAL";
    const farmName = consultation.farm?.name || "Farm Client";
    const farmerName = consultation.farmer?.name || "Farmer Client";
    const animalSpecies = consultation.animal?.species || "Livestock";
    const animalName = consultation.animal?.name || undefined;
    const verifyUrl = `${this.envService.corsOrigins?.[0] || "https://app.vetralink.com"}/verify/prescription/${consultationId}`;

    const pdfBuffer = await this.prescriptionPdfService.generatePrescriptionPdf({
      prescriptionId: prescription.id,
      consultationId,
      vetName,
      vetLicenseNumber: licenseNumber,
      farmName,
      farmerName,
      animalTag,
      animalName,
      animalSpecies,
      diagnosis: prescription.diagnosis,
      notes: prescription.notes,
      medications: prescription.medications,
      withdrawalDays: prescription.withdrawalDays,
      digitalSignatureHash: prescription.digitalSignatureHash,
      signedAt: prescription.signedAt.toISOString(),
      verifyUrl,
    });

    return {
      buffer: pdfBuffer,
      fileName: `prescription-${consultationId.slice(0, 8)}.pdf`,
      s3Key: prescription.pdfS3Key,
    };
  }

  public async verifyPrescriptionSignature(
    consultationId: string,
  ): Promise<SignatureVerificationResultDto> {
    const consultation = await this.consultationRepo.findById(consultationId);
    if (!consultation) {
      throw new EntityNotFoundException("Consultation", consultationId);
    }

    const prescription =
      await this.prescriptionRepo.findByConsultationId(consultationId);
    if (!prescription) {
      throw new EntityNotFoundException("Prescription", consultationId);
    }

    if (
      prescription.status !== PrescriptionStatus.SIGNED ||
      !prescription.digitalSignatureHash ||
      !prescription.signedAt
    ) {
      throw new ValidationDomainException(
        "Prescription has not been digitally signed yet.",
      );
    }

    const vetId = consultation.vetId ?? prescription.vetId;
    const vetProfile = await this.vetProfileRepo.findByUserId(vetId);
    const vetUser = await this.prisma.user.findUnique({
      where: { id: vetId },
      select: { name: true },
    });

    const licenseNumber = vetProfile?.licenseNumber || "UNREGISTERED-VET";
    const vetName =
      vetUser?.name || prescription.vetName || "Attending Veterinarian";
    const animalId = consultation.animalId ?? "UNSPECIFIED";
    const animalTag = consultation.animal?.tagNumber ?? "HERD-GENERAL";

    const canonicalPayload: CanonicalPrescriptionPayload = {
      prescriptionId: prescription.id,
      consultationId,
      vetId,
      vetName,
      vetLicenseNumber: licenseNumber,
      animalId,
      animalTag,
      farmId: consultation.farmId,
      diagnosis: prescription.diagnosis,
      notes: prescription.notes,
      medications: prescription.medications,
      withdrawalDays: prescription.withdrawalDays,
      signedAt: prescription.signedAt.toISOString(),
    };

    const canonicalString = this.pkiCryptoService.canonicalize(
      canonicalPayload as unknown as Record<string, unknown>,
    );
    const prescriptionHash = this.pkiCryptoService.hash(canonicalString);
    const isValid = this.pkiCryptoService.verify(
      canonicalString,
      prescription.digitalSignatureHash,
    );

    return {
      isValid,
      algorithm: "RSA-SHA256",
      prescriptionHash,
      signedAt: prescription.signedAt.toISOString(),
      signerVetName: vetName,
      signerLicenseNumber: licenseNumber,
    };
  }

  public async publicVerifyPrescription(
    id: string,
  ): Promise<PublicPrescriptionVerificationDto> {
    let prescription = await this.prescriptionRepo.findByConsultationId(id);
    if (!prescription) {
      prescription = await this.prescriptionRepo.findById(id);
    }

    if (!prescription) {
      throw new EntityNotFoundException("Prescription", id);
    }

    const consultation = await this.consultationRepo.findById(
      prescription.consultationId,
    );
    if (!consultation) {
      throw new EntityNotFoundException(
        "Consultation",
        prescription.consultationId,
      );
    }

    const vetId = consultation.vetId ?? prescription.vetId;
    const vetProfile = await this.vetProfileRepo.findByUserId(vetId);
    const vetUser = await this.prisma.user.findUnique({
      where: { id: vetId },
      select: { name: true },
    });

    const licenseNumber = vetProfile?.licenseNumber || "UNREGISTERED-VET";
    const vetName =
      vetUser?.name || prescription.vetName || "Attending Veterinarian";
    const animalId = consultation.animalId ?? "UNSPECIFIED";
    const animalTag = consultation.animal?.tagNumber ?? "HERD-GENERAL";

    // Calculate withdrawal metrics
    let maxWithdrawalDays = 0;
    let milkWithdrawalDays = 0;
    let meatWithdrawalDays = 0;

    for (const med of prescription.medications) {
      const milk = med.withdrawalDaysMilk ?? 0;
      const meat = med.withdrawalDaysMeat ?? 0;
      const total = med.withdrawalDays ?? Math.max(milk, meat);
      if (milk > milkWithdrawalDays) milkWithdrawalDays = milk;
      if (meat > meatWithdrawalDays) meatWithdrawalDays = meat;
      if (total > maxWithdrawalDays) maxWithdrawalDays = total;
    }

    let safeHarvestDate: string | null = null;
    if (maxWithdrawalDays > 0 && prescription.signedAt) {
      const harvestTime = new Date(prescription.signedAt);
      harvestTime.setUTCDate(harvestTime.getUTCDate() + maxWithdrawalDays);
      safeHarvestDate = harvestTime.toISOString();
    }

    const withdrawalSummary = {
      hasActiveWithdrawal: maxWithdrawalDays > 0,
      maxWithdrawalDays,
      milkWithdrawalDays,
      meatWithdrawalDays,
      safeHarvestDate,
    };

    const commonDetails = {
      consultationId: consultation.id,
      prescriptionId: prescription.id,
      clinicName: "VetraLink Pro Clinical Telehealth",
      attendingVet: {
        name: vetName,
        licenseNumber,
      },
      farm: {
        name: consultation.farm?.name ?? "Farm Client",
      },
      animal: {
        species: consultation.animal?.species ?? "Livestock",
        tagNumber: animalTag,
        name: consultation.animal?.name ?? null,
      },
      diagnosis: prescription.diagnosis,
      medications: prescription.medications.map((m) => ({
        name: m.name,
        formulation: m.formulation,
        route: m.route,
        dosage: m.dosage,
        frequency: m.frequency,
        durationDays: m.durationDays,
        withdrawalDays: m.withdrawalDays ?? 0,
        withdrawalDaysMilk: m.withdrawalDaysMilk,
        withdrawalDaysMeat: m.withdrawalDaysMeat,
        instructions: m.instructions,
      })),
      withdrawalSummary,
      verifiedAt: new Date().toISOString(),
    };

    if (
      prescription.status !== PrescriptionStatus.SIGNED ||
      !prescription.digitalSignatureHash ||
      !prescription.signedAt
    ) {
      return {
        isValid: false,
        status: prescription.status,
        algorithm: "RSA-SHA256",
        prescriptionHash: "",
        signedAt: prescription.signedAt?.toISOString() ?? null,
        ...commonDetails,
        tamperWarning:
          prescription.status === PrescriptionStatus.REVOKED
            ? "NOTICE: This prescription was officially revoked by the attending veterinarian."
            : "NOTICE: This prescription is in draft status and has not been cryptographically signed.",
      };
    }

    const canonicalPayload: CanonicalPrescriptionPayload = {
      prescriptionId: prescription.id,
      consultationId: consultation.id,
      vetId,
      vetName,
      vetLicenseNumber: licenseNumber,
      animalId,
      animalTag,
      farmId: consultation.farmId,
      diagnosis: prescription.diagnosis,
      notes: prescription.notes,
      medications: prescription.medications,
      withdrawalDays: prescription.withdrawalDays,
      signedAt: prescription.signedAt.toISOString(),
    };

    const canonicalString = this.pkiCryptoService.canonicalize(
      canonicalPayload as unknown as Record<string, unknown>,
    );
    const prescriptionHash = this.pkiCryptoService.hash(canonicalString);
    const isValid = this.pkiCryptoService.verify(
      canonicalString,
      prescription.digitalSignatureHash,
    );

    return {
      isValid,
      status: prescription.status,
      algorithm: "RSA-SHA256",
      prescriptionHash,
      signedAt: prescription.signedAt.toISOString(),
      ...commonDetails,
      tamperWarning: isValid
        ? undefined
        : "SECURITY WARNING: Cryptographic signature mismatch! The prescription payload has been tampered with or corrupted in storage.",
    };
  }

  private verifyDoctorWriteAccess(
    consultation: any,
    requestingUser: JwtPayload,
  ): void {
    const isSuperOrAdmin =
      requestingUser.role === UserRole.ADMIN ||
      requestingUser.role === UserRole.SUPER_ADMIN;
    const isAssignedVet =
      requestingUser.role === UserRole.VET &&
      consultation.vetId === requestingUser.sub;

    if (!isSuperOrAdmin && !isAssignedVet) {
      throw new ForbiddenOperationException(
        "Only the assigned attending veterinarian or an administrator can draft or edit prescriptions.",
      );
    }
  }

  private async verifyReadAccess(
    consultation: any,
    requestingUser: JwtPayload,
  ): Promise<void> {
    const isSuperOrAdmin =
      requestingUser.role === UserRole.ADMIN ||
      requestingUser.role === UserRole.SUPER_ADMIN;
    const isAssignedVet =
      requestingUser.role === UserRole.VET &&
      consultation.vetId === requestingUser.sub;
    const isFarmerOwner = consultation.farmerId === requestingUser.sub;

    if (isSuperOrAdmin || isAssignedVet || isFarmerOwner) {
      return;
    }

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
        "You do not have permission to view the prescription for this consultation.",
      );
    }
  }
}
