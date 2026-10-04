import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
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
  BulkProcessPayoutDto,
  ConsultationPayoutLedgerDto,
  FeeSplitCalculationDto,
  JwtPayload,
  PayoutLedgerQueryDto,
  PlatformRevenueSummaryDto,
  ProcessPayoutDto,
  UserRole,
  VetEarningsSummaryDto,
} from "@vetralink/shared-types";
import {
  CurrentUser,
  ResponseMessage,
  Roles,
} from "../../../common/decorators";
import { ForbiddenOperationException } from "../../../common/exceptions/domain.exception";
import { JwtAuthGuard, RolesGuard } from "../../../common/guards";
import {
  IVetPayoutLedgerService,
  VET_PAYOUT_LEDGER_SERVICE,
} from "../services/vet-payout-ledger.service.interface";
import {
  IConsultationRepository,
  CONSULTATION_REPOSITORY,
} from "../repositories/consultation.repository.interface";

@ApiTags("Tele-Veterinary - Fee Split & Payout Settlements")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("consultations")
export class ConsultationSettlementController {
  constructor(
    @Inject(VET_PAYOUT_LEDGER_SERVICE)
    private readonly payoutService: IVetPayoutLedgerService,
    @Inject(CONSULTATION_REPOSITORY)
    private readonly consultationRepo: IConsultationRepository,
  ) {}

  @Get("settlements/summary")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: "Get platform-wide revenue & payout summary",
    description:
      "Aggregates total gross volume, platform commissions earned, and vet payouts owed and paid.",
  })
  @ApiOkResponse({ description: "Platform revenue summary" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Admin access required" })
  @ResponseMessage("Platform revenue summary retrieved successfully")
  public async getPlatformRevenueSummary(
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ): Promise<PlatformRevenueSummaryDto> {
    return this.payoutService.getPlatformRevenueSummary({ startDate, endDate });
  }

  @Get("settlements/vet/me")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VET, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: "Get current veterinarian earnings & payout ledger",
    description:
      "Returns earnings metrics (lifetime gross, platform fee, net earnings, pending balance) and paginated payout ledger entries for the authenticated veterinarian.",
  })
  @ApiOkResponse({ description: "Current vet earnings summary & ledger" })
  @ResponseMessage("Vet earnings summary retrieved successfully")
  public async getMyEarnings(
    @CurrentUser() user: JwtPayload,
    @Query() query: PayoutLedgerQueryDto,
  ): Promise<{
    summary: VetEarningsSummaryDto;
    ledger: { items: ConsultationPayoutLedgerDto[]; total: number };
  }> {
    const [summary, ledger] = await Promise.all([
      this.payoutService.getVetEarningsSummary(user.sub),
      this.payoutService.getVetPayoutLedger(user.sub, query),
    ]);

    return { summary, ledger };
  }

  @Get("settlements/vet/:vetId")
  @ApiOperation({
    summary: "Get veterinarian earnings & payout ledger by vet ID",
    description:
      "Allows admins or the veterinarian themselves to view earnings and payout ledger entries.",
  })
  @ApiOkResponse({ description: "Vet earnings summary & ledger" })
  @ApiForbiddenResponse({ description: "Cannot access another vet's earnings" })
  @ResponseMessage("Vet earnings summary retrieved successfully")
  public async getVetEarnings(
    @Param("vetId", ParseUUIDPipe) vetId: string,
    @CurrentUser() user: JwtPayload,
    @Query() query: PayoutLedgerQueryDto,
  ): Promise<{
    summary: VetEarningsSummaryDto;
    ledger: { items: ConsultationPayoutLedgerDto[]; total: number };
  }> {
    const isSuperOrAdmin =
      user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;
    if (!isSuperOrAdmin && user.sub !== vetId) {
      throw new ForbiddenOperationException(
        "You do not have permission to view another veterinarian's earnings ledger.",
      );
    }

    const [summary, ledger] = await Promise.all([
      this.payoutService.getVetEarningsSummary(vetId),
      this.payoutService.getVetPayoutLedger(vetId, query),
    ]);

    return { summary, ledger };
  }

  @Get(":id/settlement")
  @ApiOperation({
    summary: "Get payout settlement details for a consultation",
    description:
      "Returns the fee split and payout ledger entry for a specific consultation.",
  })
  @ApiOkResponse({ description: "Consultation payout ledger details" })
  @ApiNotFoundResponse({ description: "Consultation or settlement not found" })
  @ResponseMessage("Consultation settlement retrieved successfully")
  public async getConsultationSettlement(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ConsultationPayoutLedgerDto> {
    const consultation = await this.consultationRepo.findById(id);
    if (consultation) {
      const isSuperOrAdmin =
        user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;
      const isAssignedVet = consultation.vetId === user.sub;
      const isFarmer = consultation.farmerId === user.sub;

      if (!isSuperOrAdmin && !isAssignedVet && !isFarmer) {
        throw new ForbiddenOperationException(
          "You do not have permission to view the settlement for this consultation.",
        );
      }
    }

    return this.payoutService.recordConsultationSettlement(id);
  }

  @Post(":id/settlement/calculate")
  @ApiOperation({
    summary: "Preview consultation fee split calculation",
    description:
      "Calculates the vet payout and platform fee for a consultation without creating a ledger record.",
  })
  @ApiOkResponse({ description: "Calculated fee split preview" })
  @ResponseMessage("Fee split calculated successfully")
  public async previewFeeSplit(
    @Param("id", ParseUUIDPipe) id: string,
    @Query("platformRate") platformRate?: string,
  ): Promise<FeeSplitCalculationDto> {
    const consultation = await this.consultationRepo.findById(id);
    const feeCents = consultation?.feeCents ?? 0;
    const rate = platformRate ? parseFloat(platformRate) : undefined;
    return this.payoutService.calculateSplit(feeCents, rate);
  }

  @Post("settlements/:id/process")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: "Mark a consultation payout as processed/paid",
    description:
      "Transitions a payout ledger status to PAID with reference and optional batch ID (Admin only).",
  })
  @ApiOkResponse({ description: "Payout marked as PAID" })
  @ApiForbiddenResponse({ description: "Admin access required" })
  @ResponseMessage("Payout processed successfully")
  public async processPayout(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: ProcessPayoutDto,
  ): Promise<ConsultationPayoutLedgerDto> {
    return this.payoutService.processPayout(id, dto, user.sub);
  }

  @Post("settlements/bulk-process")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: "Bulk process payouts for a veterinarian",
    description:
      "Transitions multiple payout ledger entries for a vet to PAID in a single batch (Admin only).",
  })
  @ApiOkResponse({ description: "Bulk payouts processed" })
  @ApiForbiddenResponse({ description: "Admin access required" })
  @ResponseMessage("Bulk payouts processed successfully")
  public async bulkProcessPayouts(
    @CurrentUser() user: JwtPayload,
    @Body() dto: BulkProcessPayoutDto,
  ): Promise<{ processedCount: number; totalPaidCents: number }> {
    return this.payoutService.bulkProcessPayouts(
      dto.vetId,
      dto.payoutIds,
      {
        payoutReference: dto.payoutReference,
        payoutBatchId: dto.payoutBatchId,
      },
      user.sub,
    );
  }
}
