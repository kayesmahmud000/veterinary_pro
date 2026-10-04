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
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import {
  ConsultationReviewDto,
  JwtPayload,
  ModerateReviewDto,
  ReviewQueryDto,
  SubmitConsultationReviewDto,
  UserRole,
  VetRatingSummaryDto,
} from "@vetralink/shared-types";
import {
  CurrentUser,
  ResponseMessage,
  Roles,
} from "../../../common/decorators";
import { JwtAuthGuard, RolesGuard } from "../../../common/guards";
import {
  CONSULTATION_REVIEW_SERVICE,
  IConsultationReviewService,
} from "../services/consultation-review.service.interface";

@ApiTags("Tele-Veterinary - Consultation Rating & Reviews")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("consultations")
export class ConsultationReviewController {
  constructor(
    @Inject(CONSULTATION_REVIEW_SERVICE)
    private readonly reviewService: IConsultationReviewService,
  ) {}

  @Get("reviews/moderation")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: "Get reviews queue for moderation",
    description:
      "Lists reviews filtered by status (PENDING, FLAGGED, REJECTED, APPROVED) for administrative moderation.",
  })
  @ApiOkResponse({ description: "Moderation reviews list" })
  @ApiForbiddenResponse({ description: "Admin access required" })
  @ResponseMessage("Reviews moderation list retrieved successfully")
  public async getModerationReviews(
    @Query() query: ReviewQueryDto,
  ): Promise<{ items: ConsultationReviewDto[]; total: number }> {
    return this.reviewService.getModerationReviews(query);
  }

  @Get("reviews/vet/:vetId/summary")
  @ApiOperation({
    summary: "Get veterinarian rating summary & distribution",
    description:
      "Calculates average rating, total review count, 1-5 star distribution, and frequent clinical tags for a vet.",
  })
  @ApiOkResponse({ description: "Vet rating summary" })
  @ResponseMessage("Vet rating summary retrieved successfully")
  public async getVetRatingSummary(
    @Param("vetId", ParseUUIDPipe) vetId: string,
  ): Promise<VetRatingSummaryDto> {
    return this.reviewService.getVetRatingSummary(vetId);
  }

  @Get("reviews/vet/:vetId")
  @ApiOperation({
    summary: "Get approved reviews for a veterinarian",
    description:
      "Returns a paginated list of public, approved reviews for a veterinarian.",
  })
  @ApiOkResponse({ description: "List of vet reviews" })
  @ResponseMessage("Vet reviews retrieved successfully")
  public async getVetReviews(
    @Param("vetId", ParseUUIDPipe) vetId: string,
    @Query() query: ReviewQueryDto,
  ): Promise<{ items: ConsultationReviewDto[]; total: number }> {
    return this.reviewService.getVetReviews(vetId, query);
  }

  @Post("reviews/:id/moderate")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: "Moderate a consultation review",
    description:
      "Admin action to approve, flag, or reject a farmer review, recalculating the vet's rating aggregates.",
  })
  @ApiOkResponse({ description: "Review moderated successfully" })
  @ApiNotFoundResponse({ description: "Review not found" })
  @ApiForbiddenResponse({ description: "Admin access required" })
  @ResponseMessage("Review moderated successfully")
  public async moderateReview(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: ModerateReviewDto,
  ): Promise<ConsultationReviewDto> {
    return this.reviewService.moderateReview(id, dto, user);
  }

  @Post(":id/review")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.FARMER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: "Submit a review for a completed consultation",
    description:
      "Allows the farmer who completed the consultation to submit a 1-5 star rating with qualitative feedback and tags.",
  })
  @ApiOkResponse({ description: "Review submitted successfully" })
  @ApiConflictResponse({ description: "Review already exists for this consultation" })
  @ApiForbiddenResponse({ description: "Only the participating farmer can review" })
  @ResponseMessage("Consultation review submitted successfully")
  public async submitReview(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: SubmitConsultationReviewDto,
  ): Promise<ConsultationReviewDto> {
    return this.reviewService.submitReview(id, user, dto);
  }

  @Get(":id/review")
  @ApiOperation({
    summary: "Get the review for a specific consultation",
    description:
      "Fetches the submitted review for the consultation if available.",
  })
  @ApiOkResponse({ description: "Consultation review or null" })
  @ResponseMessage("Consultation review retrieved successfully")
  public async getConsultationReview(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ConsultationReviewDto | null> {
    return this.reviewService.getConsultationReview(id, user);
  }
}
