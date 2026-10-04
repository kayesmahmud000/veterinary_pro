import {
  MedicationFormulation,
  MedicationRoute,
  PrescriptionDto,
  PrescriptionStatus,
  StructuredMedicationItemDto,
} from "@vetralink/shared-types";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";

export interface PrescriptionProps {
  id: string;
  consultationId: string;
  vetId: string;
  status: PrescriptionStatus;
  diagnosis: string;
  notes?: string | null;
  medications: StructuredMedicationItemDto[];
  pdfS3Key?: string | null;
  digitalSignatureHash?: string | null;
  signedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  vetName?: string;
}

export interface CreatePrescriptionProps {
  consultationId: string;
  vetId: string;
  diagnosis: string;
  notes?: string;
  medications: StructuredMedicationItemDto[];
  vetName?: string;
}

export class PrescriptionEntity {
  private readonly _id: string;
  private readonly _consultationId: string;
  private readonly _vetId: string;
  private _status: PrescriptionStatus;
  private _diagnosis: string;
  private _notes: string | null;
  private _medications: StructuredMedicationItemDto[];
  private _pdfS3Key: string | null;
  private _digitalSignatureHash: string | null;
  private _signedAt: Date | null;
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _vetName?: string;

  private constructor(props: PrescriptionProps) {
    this._id = props.id;
    this._consultationId = props.consultationId;
    this._vetId = props.vetId;
    this._status = props.status;
    this._diagnosis = props.diagnosis;
    this._notes = props.notes ?? null;
    this._medications = props.medications;
    this._pdfS3Key = props.pdfS3Key ?? null;
    this._digitalSignatureHash = props.digitalSignatureHash ?? null;
    this._signedAt = props.signedAt ?? null;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
    this._vetName = props.vetName;
  }

  public static create(props: CreatePrescriptionProps): PrescriptionEntity {
    if (!props.consultationId || props.consultationId.trim() === "") {
      throw new ValidationDomainException(
        "Consultation ID is required to create a prescription.",
      );
    }

    if (!props.vetId || props.vetId.trim() === "") {
      throw new ValidationDomainException(
        "Attending veterinarian ID is required to create a prescription.",
      );
    }

    const trimmedDiagnosis = (props.diagnosis || "").trim();
    if (!trimmedDiagnosis) {
      throw new ValidationDomainException("Clinical diagnosis is required.");
    }
    if (trimmedDiagnosis.length > 500) {
      throw new ValidationDomainException(
        "Clinical diagnosis cannot exceed 500 characters.",
      );
    }

    const validatedMedications = PrescriptionEntity.validateMedications(
      props.medications,
    );

    const now = new Date();
    return new PrescriptionEntity({
      id: crypto.randomUUID(),
      consultationId: props.consultationId,
      vetId: props.vetId,
      status: PrescriptionStatus.DRAFT,
      diagnosis: trimmedDiagnosis,
      notes: props.notes?.trim() || null,
      medications: validatedMedications,
      pdfS3Key: null,
      digitalSignatureHash: null,
      signedAt: null,
      createdAt: now,
      updatedAt: now,
      vetName: props.vetName,
    });
  }

  public static fromPersistence(raw: any): PrescriptionEntity {
    const rawMeds = Array.isArray(raw.medications)
      ? raw.medications
      : typeof raw.medications === "string"
        ? JSON.parse(raw.medications)
        : [];

    return new PrescriptionEntity({
      id: raw.id,
      consultationId: raw.consultationId,
      vetId: raw.vetId,
      status: (raw.status as PrescriptionStatus) ?? PrescriptionStatus.DRAFT,
      diagnosis: raw.diagnosis,
      notes: raw.notes ?? null,
      medications: rawMeds,
      pdfS3Key: raw.pdfS3Key ?? null,
      digitalSignatureHash: raw.digitalSignatureHash ?? null,
      signedAt: raw.signedAt ? new Date(raw.signedAt) : null,
      createdAt: new Date(raw.createdAt),
      updatedAt: new Date(raw.updatedAt),
      vetName: raw.vet?.name,
    });
  }

  public update(props: {
    diagnosis?: string;
    notes?: string;
    medications?: StructuredMedicationItemDto[];
  }): void {
    if (this._status === PrescriptionStatus.SIGNED) {
      throw new ValidationDomainException(
        "Cannot modify a signed prescription. Please create a new revised prescription or revoke this one.",
      );
    }

    if (this._status === PrescriptionStatus.REVOKED) {
      throw new ValidationDomainException(
        "Cannot modify a revoked prescription.",
      );
    }

    if (props.diagnosis !== undefined) {
      const trimmed = props.diagnosis.trim();
      if (!trimmed) {
        throw new ValidationDomainException("Clinical diagnosis is required.");
      }
      if (trimmed.length > 500) {
        throw new ValidationDomainException(
          "Clinical diagnosis cannot exceed 500 characters.",
        );
      }
      this._diagnosis = trimmed;
    }

    if (props.notes !== undefined) {
      this._notes = props.notes?.trim() || null;
    }

    if (props.medications !== undefined) {
      this._medications = PrescriptionEntity.validateMedications(
        props.medications,
      );
    }

    this._updatedAt = new Date();
  }

  public sign(
    signatureOrParams:
      | string
      | { digitalSignatureHash: string; pdfS3Key?: string; signedAt?: Date },
    pdfS3Key?: string,
    signedAt?: Date,
  ): void {
    if (this._status === PrescriptionStatus.SIGNED) {
      throw new ValidationDomainException("Prescription is already signed.");
    }
    if (this._status === PrescriptionStatus.REVOKED) {
      throw new ValidationDomainException("Cannot sign a revoked prescription.");
    }

    let hash: string;
    let s3Key: string | undefined = pdfS3Key;
    let signDate: Date = signedAt ?? new Date();

    if (typeof signatureOrParams === "object") {
      hash = signatureOrParams.digitalSignatureHash;
      s3Key = signatureOrParams.pdfS3Key ?? s3Key;
      signDate = signatureOrParams.signedAt ?? signDate;
    } else {
      hash = signatureOrParams;
    }

    if (!hash || hash.trim() === "") {
      throw new ValidationDomainException(
        "Digital signature hash is required to sign the prescription.",
      );
    }

    this._status = PrescriptionStatus.SIGNED;
    this._digitalSignatureHash = hash.trim();
    this._pdfS3Key = s3Key ?? this._pdfS3Key;
    this._signedAt = signDate;
    this._updatedAt = signDate;
  }

  public revoke(reason?: string): void {
    if (this._status === PrescriptionStatus.REVOKED) {
      throw new ValidationDomainException("Prescription is already revoked.");
    }
    this._status = PrescriptionStatus.REVOKED;
    if (reason && reason.trim()) {
      this._notes = this._notes
        ? `${this._notes}\nREVOKED: ${reason.trim()}`
        : `REVOKED: ${reason.trim()}`;
    }
    this._updatedAt = new Date();
  }

  public toDto(): PrescriptionDto {
    return {
      id: this._id,
      consultationId: this._consultationId,
      vetId: this._vetId,
      vetName: this._vetName ?? "Attending Veterinarian",
      status: this._status,
      diagnosis: this._diagnosis,
      notes: this._notes,
      medications: this._medications,
      withdrawalDays: this.withdrawalDays,
      pdfS3Key: this._pdfS3Key,
      digitalSignatureHash: this._digitalSignatureHash,
      signedAt: this._signedAt ? this._signedAt.toISOString() : null,
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
    };
  }

  private static validateMedications(
    medications: StructuredMedicationItemDto[],
  ): StructuredMedicationItemDto[] {
    if (!medications || !Array.isArray(medications) || medications.length === 0) {
      throw new ValidationDomainException(
        "Prescription must contain at least one prescribed medication.",
      );
    }

    return medications.map((med, index) => {
      const name = (med.name || "").trim();
      if (!name) {
        throw new ValidationDomainException(
          `Medication at position ${index + 1} must specify a drug name.`,
        );
      }

      const dosage = (med.dosage || "").trim();
      if (!dosage) {
        throw new ValidationDomainException(
          `Medication '${name}' must specify a dosage (e.g., '10 ml' or '20 mg/kg').`,
        );
      }

      const frequency = (med.frequency || "").trim();
      if (!frequency) {
        throw new ValidationDomainException(
          `Medication '${name}' must specify an administration frequency (e.g., 'Once daily').`,
        );
      }

      const durationDays = Number(med.durationDays);
      if (isNaN(durationDays) || durationDays < 1) {
        throw new ValidationDomainException(
          `Medication '${name}' duration must be at least 1 day.`,
        );
      }

      if (med.withdrawalDaysMilk !== undefined && Number(med.withdrawalDaysMilk) < 0) {
        throw new ValidationDomainException(
          `Medication '${name}' withdrawal days for milk cannot be negative.`,
        );
      }
      if (med.withdrawalDaysMeat !== undefined && Number(med.withdrawalDaysMeat) < 0) {
        throw new ValidationDomainException(
          `Medication '${name}' withdrawal days for meat cannot be negative.`,
        );
      }
      if (med.withdrawalDays !== undefined && Number(med.withdrawalDays) < 0) {
        throw new ValidationDomainException(
          `Medication '${name}' withdrawal days cannot be negative.`,
        );
      }

      const withdrawalDaysMilk = Number(med.withdrawalDaysMilk || 0);
      const withdrawalDaysMeat = Number(med.withdrawalDaysMeat || 0);
      const withdrawalDays =
        med.withdrawalDays !== undefined
          ? Number(med.withdrawalDays)
          : Math.max(withdrawalDaysMilk, withdrawalDaysMeat);

      return {
        name,
        formulation: med.formulation || MedicationFormulation.OTHER,
        dosage,
        frequency,
        durationDays,
        route: med.route || MedicationRoute.OTHER,
        withdrawalDays,
        withdrawalDaysMilk,
        withdrawalDaysMeat,
        instructions: med.instructions?.trim() || undefined,
      };
    });
  }

  // Getters
  public get id(): string {
    return this._id;
  }

  public get consultationId(): string {
    return this._consultationId;
  }

  public get vetId(): string {
    return this._vetId;
  }

  public get status(): PrescriptionStatus {
    return this._status;
  }

  public get diagnosis(): string {
    return this._diagnosis;
  }

  public get notes(): string | null {
    return this._notes;
  }

  public get medications(): StructuredMedicationItemDto[] {
    return [...this._medications];
  }

  public get pdfS3Key(): string | null {
    return this._pdfS3Key;
  }

  public get digitalSignatureHash(): string | null {
    return this._digitalSignatureHash;
  }

  public get signedAt(): Date | null {
    return this._signedAt;
  }

  public get createdAt(): Date {
    return this._createdAt;
  }

  public get updatedAt(): Date {
    return this._updatedAt;
  }

  public get withdrawalDays(): number {
    return this._medications.reduce(
      (max, med) => Math.max(max, med.withdrawalDays || 0),
      0,
    );
  }

  public get vetName(): string | undefined {
    return this._vetName;
  }
}
