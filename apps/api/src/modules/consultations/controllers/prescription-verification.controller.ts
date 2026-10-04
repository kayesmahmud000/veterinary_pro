import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
} from "@nestjs/common";
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { PublicPrescriptionVerificationDto } from "@vetralink/shared-types";
import { Public, ResponseMessage } from "../../../common/decorators";
import {
  IPrescriptionService,
  PRESCRIPTION_SERVICE,
} from "../services/prescription.service.interface";

@ApiTags("Public - Veterinary Prescription Verification")
@Controller("verify/prescription")
export class PrescriptionVerificationController {
  constructor(
    @Inject(PRESCRIPTION_SERVICE)
    private readonly prescriptionService: IPrescriptionService,
  ) {}

  @Get(":id")
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Public cryptographic verification of a veterinary prescription",
    description:
      "Allows external third parties (pharmacists, food safety inspectors, customs officers, buyers) to verify the authenticity, data integrity, attending veterinarian credentials, and food safety withdrawal periods of a veterinary prescription without authentication.",
  })
  @ApiOkResponse({
    description: "Prescription verification result returned successfully",
  })
  @ApiNotFoundResponse({ description: "Prescription not found" })
  @ResponseMessage("Prescription verification completed successfully")
  public async verifyPrescription(
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<PublicPrescriptionVerificationDto> {
    return this.prescriptionService.publicVerifyPrescription(id);
  }
}
