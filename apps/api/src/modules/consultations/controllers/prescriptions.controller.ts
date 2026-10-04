import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import {
  CreatePrescriptionDto,
  JwtPayload,
  PrescriptionDto,
  SignPrescriptionDto,
  SignatureVerificationResultDto,
  UpdatePrescriptionDto,
  UserRole,
} from "@vetralink/shared-types";
import { CurrentUser, ResponseMessage, Roles } from "../../../common/decorators";
import { JwtAuthGuard, RolesGuard } from "../../../common/guards";
import {
  IPrescriptionService,
  PRESCRIPTION_SERVICE,
} from "../services/prescription.service.interface";

@ApiTags("Tele-Veterinary - Prescriptions")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("consultations")
export class PrescriptionsController {
  constructor(
    @Inject(PRESCRIPTION_SERVICE)
    private readonly prescriptionService: IPrescriptionService,
  ) {}

  @Post(":id/prescription")
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VET)
  @ApiOperation({
    summary: "Draft a structured veterinary prescription for a consultation",
    description:
      "Records a structured prescription with clinical diagnosis, medications (dosage, route, frequency, duration, milk/meat withdrawal days), and instructions. Accessible only to attending veterinarians and administrators.",
  })
  @ApiOkResponse({
    description: "Prescription drafted successfully",
  })
  @ApiNotFoundResponse({ description: "Consultation not found" })
  @ApiUnauthorizedResponse({ description: "JWT authentication required" })
  @ApiForbiddenResponse({
    description:
      "Only the assigned attending veterinarian or an administrator can draft prescriptions",
  })
  @ResponseMessage("Prescription drafted successfully")
  public async createPrescription(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreatePrescriptionDto,
  ): Promise<PrescriptionDto> {
    return this.prescriptionService.createPrescription(
      id,
      user,
      dto,
      `user-${user.sub}`,
    );
  }

  @Get(":id/prescription")
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VET, UserRole.FARMER)
  @ApiOperation({
    summary: "Retrieve the prescription for a consultation",
    description:
      "Fetches the consultation's prescription. Farmers can only view signed prescriptions; draft prescriptions remain confidential to medical staff.",
  })
  @ApiOkResponse({
    description: "Prescription retrieved successfully",
  })
  @ApiNotFoundResponse({ description: "Consultation not found" })
  @ApiUnauthorizedResponse({ description: "JWT authentication required" })
  @ApiForbiddenResponse({
    description: "Insufficient permissions to view this prescription",
  })
  @ResponseMessage("Prescription retrieved successfully")
  public async getPrescription(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<PrescriptionDto | null> {
    return this.prescriptionService.getPrescription(id, user);
  }

  @Patch(":id/prescription")
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VET)
  @ApiOperation({
    summary: "Update an existing draft prescription",
    description:
      "Modifies diagnosis, notes, or structured medication items. Permitted only while the prescription remains in DRAFT status.",
  })
  @ApiOkResponse({
    description: "Prescription updated successfully",
  })
  @ApiNotFoundResponse({ description: "Consultation or prescription not found" })
  @ApiUnauthorizedResponse({ description: "JWT authentication required" })
  @ApiForbiddenResponse({
    description:
      "Only the assigned attending veterinarian or an administrator can edit draft prescriptions",
  })
  @ResponseMessage("Prescription updated successfully")
  public async updatePrescription(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdatePrescriptionDto,
  ): Promise<PrescriptionDto> {
    return this.prescriptionService.updatePrescription(
      id,
      user,
      dto,
      `user-${user.sub}`,
    );
  }

  @Post(":id/prescription/sign")
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VET)
  @ApiOperation({
    summary: "Cryptographically sign a veterinary prescription (RSA-SHA256)",
    description:
      "Applies an asymmetric PKI digital signature to the canonical prescription hash using RSA-SHA256. Transitions the prescription to SIGNED status and permanently locks further edits.",
  })
  @ApiOkResponse({
    description: "Prescription digitally signed successfully",
  })
  @ApiNotFoundResponse({ description: "Consultation or prescription not found" })
  @ApiUnauthorizedResponse({ description: "JWT authentication required" })
  @ApiForbiddenResponse({
    description:
      "Only the assigned attending veterinarian or an administrator can sign prescriptions",
  })
  @ResponseMessage("Prescription digitally signed successfully")
  public async signPrescription(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto?: SignPrescriptionDto,
  ): Promise<PrescriptionDto> {
    return this.prescriptionService.signPrescription(
      id,
      user,
      dto,
      `user-${user.sub}`,
    );
  }

  @Get(":id/prescription/verify-signature")
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VET, UserRole.FARMER)
  @ApiOperation({
    summary: "Cryptographically verify a prescription digital signature",
    description:
      "Reconstructs the canonical prescription payload and verifies the RSA-SHA256 signature against the public key, ensuring prescription authenticity and data integrity.",
  })
  @ApiOkResponse({
    description: "Prescription signature verified successfully",
  })
  @ApiNotFoundResponse({ description: "Consultation or prescription not found" })
  @ApiUnauthorizedResponse({ description: "JWT authentication required" })
  @ResponseMessage("Prescription signature verified successfully")
  public async verifyPrescriptionSignature(
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<SignatureVerificationResultDto> {
    return this.prescriptionService.verifyPrescriptionSignature(id);
  }

  @Get(":id/prescription/pdf")
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VET, UserRole.FARMER)
  @ApiOperation({
    summary: "Download or view the official signed prescription PDF",
    description:
      "Streams the official signed prescription PDF with clinic letterhead, veterinarian license #, structured medications table, food safety withdrawal warnings, and PKI verification QR code.",
  })
  @ApiOkResponse({
    description: "Prescription PDF stream returned successfully",
    content: {
      "application/pdf": {
        schema: { type: "string", format: "binary" },
      },
    },
  })
  @ApiNotFoundResponse({ description: "Consultation or prescription not found" })
  @ApiUnauthorizedResponse({ description: "JWT authentication required" })
  public async getPrescriptionPdf(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, fileName } =
      await this.prescriptionService.getPrescriptionPdf(id, user);

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${fileName}"`,
      "Content-Length": buffer.length,
    });

    res.end(buffer);
  }
}

