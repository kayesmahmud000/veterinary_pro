import {
  CreatePrescriptionDto,
  JwtPayload,
  PrescriptionDto,
  PublicPrescriptionVerificationDto,
  SignPrescriptionDto,
  SignatureVerificationResultDto,
  UpdatePrescriptionDto,
} from "@vetralink/shared-types";

export const PRESCRIPTION_SERVICE = Symbol("PRESCRIPTION_SERVICE");

export interface IPrescriptionService {
  createPrescription(
    consultationId: string,
    author: JwtPayload,
    dto: CreatePrescriptionDto,
    traceId?: string,
  ): Promise<PrescriptionDto>;

  getPrescription(
    consultationId: string,
    requestingUser: JwtPayload,
  ): Promise<PrescriptionDto | null>;

  updatePrescription(
    consultationId: string,
    author: JwtPayload,
    dto: UpdatePrescriptionDto,
    traceId?: string,
  ): Promise<PrescriptionDto>;

  signPrescription(
    consultationId: string,
    author: JwtPayload,
    dto?: SignPrescriptionDto,
    traceId?: string,
  ): Promise<PrescriptionDto>;

  verifyPrescriptionSignature(
    consultationId: string,
  ): Promise<SignatureVerificationResultDto>;

  getPrescriptionPdf(
    consultationId: string,
    requestingUser: JwtPayload,
  ): Promise<{ buffer: Buffer; fileName: string; s3Key?: string | null }>;

  publicVerifyPrescription(
    id: string,
  ): Promise<PublicPrescriptionVerificationDto>;
}

