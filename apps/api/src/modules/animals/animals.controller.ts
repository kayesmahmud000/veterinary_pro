import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { Response } from "express";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from "@nestjs/swagger";
import {
  AnimalImportJobDto,
  AnimalLineageDto,
  AnimalQrCodeDto,
  AnimalResponseDto,
  AnimalWeightLogDto,
  FarmRole,
  GrowthCurveAnalyticsDto,
  JwtPayload,
  PaginatedAnimalsDto,
  PaginatedImportJobsDto,
  PaginatedWeightLogsDto,
  SubscriptionQuotaType,
  TagAvailabilityResponseDto,
} from "@vetralink/shared-types";
import {
  CheckQuota,
  CurrentFarm,
  CurrentUser,
  FarmRoles,
  RequireFeature,
  ResponseMessage,
  Tenant,
} from "../../common/decorators";
import {
  JwtAuthGuard,
  SubscriptionQuotaGuard,
  TenantGuard,
} from "../../common/guards";
import {
  ANIMALS_SERVICE,
  IAnimalsService,
} from "./services/animals.service.interface";
import {
  ANIMAL_TAG_SERVICE,
  IAnimalTagService,
} from "./services/animal-tag.service.interface";
import {
  AnimalLineageQueryDto,
  AnimalQrCodeQueryDto,
  AnimalQueryDto,
  CheckTagAvailabilityQueryDto,
  PrintBatchTagBadgesDto,
  RecordWeightRequestDto,
  RegisterAnimalDto,
  UpdateAnimalDto,
  WeightHistoryQueryRequestDto,
} from "./dto";

@ApiTags("Animals")
@Controller("animals")
@UseGuards(JwtAuthGuard, TenantGuard, SubscriptionQuotaGuard)
@Tenant()
@ApiBearerAuth()
@ApiHeader({
  name: "x-farm-id",
  required: true,
  description: "Target farm tenant UUID",
})
export class AnimalsController {
  constructor(
    @Inject(ANIMALS_SERVICE)
    private readonly animalsService: IAnimalsService,
    @Inject(ANIMAL_TAG_SERVICE)
    private readonly tagService: IAnimalTagService
  ) {}

  @Post()
  @CheckQuota(SubscriptionQuotaType.ANIMALS)
  @FarmRoles(
    FarmRole.OWNER,
    FarmRole.MANAGER,
    FarmRole.HERDSMAN,
    FarmRole.VET_STAFF
  )
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage("Animal registered successfully")
  @ApiOperation({
    summary: "Register a new animal in the tenant farm herd",
  })
  @ApiCreatedResponse({ description: "Animal registered successfully" })
  @ApiConflictResponse({
    description: "Duplicate active tag number in farm herd",
  })
  @ApiUnprocessableEntityResponse({
    description: "Validation failure or invalid pedigree invariant",
  })
  @ApiNotFoundResponse({ description: "Sire or dam not found in this farm" })
  @ApiForbiddenResponse({
    description: "Access denied: Not a member or insufficient farm permissions",
  })
  @ApiUnauthorizedResponse({ description: "Missing or invalid JWT token" })
  public async registerAnimal(
    @CurrentFarm("id") farmId: string,
    @Body() dto: RegisterAnimalDto,
    @CurrentUser() user: JwtPayload,
    @Headers("x-trace-id") traceId?: string
  ): Promise<AnimalResponseDto> {
    return this.animalsService.registerAnimal(farmId, dto, user.sub, traceId);
  }

  @Get()
  @FarmRoles(
    FarmRole.OWNER,
    FarmRole.MANAGER,
    FarmRole.HERDSMAN,
    FarmRole.VET_STAFF
  )
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("Animals retrieved successfully")
  @ApiOperation({
    summary: "List animals in the tenant farm with pagination and filters",
  })
  @ApiOkResponse({ description: "Paginated animal records" })
  @ApiForbiddenResponse({ description: "Access denied to target farm" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid JWT token" })
  public async getAnimals(
    @CurrentFarm("id") farmId: string,
    @Query() query: AnimalQueryDto
  ): Promise<PaginatedAnimalsDto> {
    return this.animalsService.getAnimals(farmId, query);
  }

  @Get("check-tag")
  @FarmRoles(
    FarmRole.OWNER,
    FarmRole.MANAGER,
    FarmRole.HERDSMAN,
    FarmRole.VET_STAFF
  )
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("Tag availability checked")
  @ApiOperation({
    summary: "Check availability of ear tag and/or RFID number in the tenant herd",
  })
  @ApiOkResponse({ description: "Tag availability status" })
  @ApiForbiddenResponse({ description: "Access denied to target farm" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid JWT token" })
  public async checkTagAvailability(
    @CurrentFarm("id") farmId: string,
    @Query() query: CheckTagAvailabilityQueryDto
  ): Promise<TagAvailabilityResponseDto> {
    return this.animalsService.checkTagAvailability(farmId, query);
  }

  @Get("lookup/:identifier")
  @FarmRoles(
    FarmRole.OWNER,
    FarmRole.MANAGER,
    FarmRole.HERDSMAN,
    FarmRole.VET_STAFF
  )
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("Animal resolved by identifier")
  @ApiOperation({
    summary: "Scan-to-lookup animal profile by visual ear tag OR electronic RFID transponder",
  })
  @ApiOkResponse({ description: "Animal profile resolved by scanner" })
  @ApiNotFoundResponse({ description: "No active animal matches tag/RFID identifier" })
  @ApiForbiddenResponse({ description: "Access denied to target farm" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid JWT token" })
  public async lookupByIdentifier(
    @CurrentFarm("id") farmId: string,
    @Param("identifier") identifier: string
  ): Promise<AnimalResponseDto> {
    return this.animalsService.lookupByIdentifier(identifier, farmId);
  }

  @Post("import")
  @RequireFeature("bulkImportExport")
  @CheckQuota(SubscriptionQuotaType.ANIMALS)
  @FarmRoles(FarmRole.OWNER, FarmRole.MANAGER)
  @HttpCode(HttpStatus.ACCEPTED)
  @UseInterceptors(FileInterceptor("file"))
  @ResponseMessage("Import job created successfully")
  @ApiOperation({ summary: "Bulk import animals via CSV or Excel spreadsheet" })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: {
          type: "string",
          format: "binary",
        },
      },
    },
  })
  @ApiAcceptedResponse({ description: "Import job enqueued for background processing" })
  @ApiForbiddenResponse({ description: "Requires FarmRole OWNER or MANAGER" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid JWT token" })
  public async bulkImportAnimals(
    @CurrentFarm("id") farmId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: JwtPayload,
    @Headers("x-trace-id") traceId?: string
  ): Promise<AnimalImportJobDto> {
    return this.animalsService.createImportJob(
      farmId,
      file,
      user.sub,
      traceId
    );
  }

  @Get("import/template")
  @FarmRoles(
    FarmRole.OWNER,
    FarmRole.MANAGER,
    FarmRole.HERDSMAN,
    FarmRole.VET_STAFF
  )
  @HttpCode(HttpStatus.OK)
  @Header("Content-Type", "text/csv")
  @Header("Content-Disposition", "attachment; filename=animal_import_template.csv")
  @ApiOperation({ summary: "Download sample CSV template for animal bulk import" })
  @ApiOkResponse({ description: "CSV template content" })
  @ApiForbiddenResponse({ description: "Access denied to target farm" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid JWT token" })
  public getImportTemplate(): string {
    return this.animalsService.generateImportTemplate();
  }

  @Get("import/jobs")
  @FarmRoles(
    FarmRole.OWNER,
    FarmRole.MANAGER,
    FarmRole.HERDSMAN,
    FarmRole.VET_STAFF
  )
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("Import jobs retrieved successfully")
  @ApiOperation({ summary: "Get paginated list of animal import jobs for the farm" })
  @ApiOkResponse({ description: "List of import jobs with progress status" })
  @ApiForbiddenResponse({ description: "Access denied to target farm" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid JWT token" })
  public async getImportJobs(
    @CurrentFarm("id") farmId: string,
    @Query("page") page?: number,
    @Query("limit") limit?: number
  ): Promise<PaginatedImportJobsDto> {
    return this.animalsService.getImportJobs(
      farmId,
      page ? Number(page) : 1,
      limit ? Number(limit) : 20
    );
  }

  @Get("import/jobs/:jobId")
  @FarmRoles(
    FarmRole.OWNER,
    FarmRole.MANAGER,
    FarmRole.HERDSMAN,
    FarmRole.VET_STAFF
  )
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("Import job details retrieved successfully")
  @ApiOperation({ summary: "Get animal import job status and validation error report" })
  @ApiOkResponse({ description: "Import job details with error report" })
  @ApiNotFoundResponse({ description: "Import job not found" })
  @ApiForbiddenResponse({ description: "Access denied to target farm" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid JWT token" })
  public async getImportJob(
    @CurrentFarm("id") farmId: string,
    @Param("jobId", ParseUUIDPipe) jobId: string
  ): Promise<AnimalImportJobDto> {
    return this.animalsService.getImportJob(jobId, farmId);
  }

  @Post("tag-badges/batch")
  @FarmRoles(
    FarmRole.OWNER,
    FarmRole.MANAGER,
    FarmRole.HERDSMAN,
    FarmRole.VET_STAFF
  )
  @ApiOperation({
    summary: "Generate printable multi-page batch PDF tag/placard sheets for the herd",
  })
  @ApiProduces("application/pdf")
  @ApiOkResponse({
    description: "Binary PDF stream containing printable grid sheets",
  })
  @ApiForbiddenResponse({ description: "Access denied to target farm" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid JWT token" })
  public async printBatchTagBadges(
    @CurrentFarm("id") farmId: string,
    @Body() dto: PrintBatchTagBadgesDto,
    @Res() res: Response
  ): Promise<void> {
    const result = await this.tagService.generateBatchTagBadgesPdf(farmId, dto);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="farm-tags-${Date.now()}.pdf"`
    );
    res.setHeader("Content-Length", result.buffer.length.toString());
    res.status(HttpStatus.OK).end(result.buffer);
  }

  @Get(":id/qr-code")
  @FarmRoles(
    FarmRole.OWNER,
    FarmRole.MANAGER,
    FarmRole.HERDSMAN,
    FarmRole.VET_STAFF
  )
  @ApiOperation({
    summary: "Generate scannable QR code for an animal (data URL JSON or raw PNG)",
  })
  @ApiOkResponse({ description: "QR code data URL or raw PNG stream" })
  @ApiNotFoundResponse({ description: "Animal not found in this farm" })
  @ApiForbiddenResponse({ description: "Access denied to target farm" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid JWT token" })
  public async getAnimalQrCode(
    @CurrentFarm("id") farmId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Query() query: AnimalQrCodeQueryDto,
    @Res() res: Response
  ): Promise<void> {
    if (query.format === "png") {
      const result = await this.tagService.generateQrCodePngBuffer(farmId, id);
      res.setHeader("Content-Type", "image/png");
      res.setHeader(
        "Content-Disposition",
        `inline; filename="qr-${result.tagNumber}.png"`
      );
      res.setHeader("Content-Length", result.buffer.length.toString());
      res.status(HttpStatus.OK).end(result.buffer);
      return;
    }

    const qrData = await this.tagService.generateQrCode(farmId, id);
    res.status(HttpStatus.OK).json({
      success: true,
      statusCode: HttpStatus.OK,
      message: "Animal QR code generated successfully",
      data: qrData,
      timestamp: new Date().toISOString(),
    });
  }

  @Get(":id/tag-badge")
  @FarmRoles(
    FarmRole.OWNER,
    FarmRole.MANAGER,
    FarmRole.HERDSMAN,
    FarmRole.VET_STAFF
  )
  @ApiOperation({
    summary: "Generate high-visibility single printable placard / ear tag badge PDF",
  })
  @ApiProduces("application/pdf")
  @ApiOkResponse({
    description: "Binary PDF stream containing printable placard badge",
  })
  @ApiNotFoundResponse({ description: "Animal not found in this farm" })
  @ApiForbiddenResponse({ description: "Access denied to target farm" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid JWT token" })
  public async getAnimalTagBadgePdf(
    @CurrentFarm("id") farmId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Res() res: Response
  ): Promise<void> {
    const result = await this.tagService.generateSingleTagBadgePdf(farmId, id);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="tag-${result.tagNumber}.pdf"`
    );
    res.setHeader("Content-Length", result.buffer.length.toString());
    res.status(HttpStatus.OK).end(result.buffer);
  }

  @Get(":id/lineage")
  @FarmRoles(
    FarmRole.OWNER,
    FarmRole.MANAGER,
    FarmRole.HERDSMAN,
    FarmRole.VET_STAFF
  )
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("Animal lineage retrieved successfully")
  @ApiOperation({
    summary: "Retrieve recursive ancestral pedigree graph and progeny for an animal",
  })
  @ApiOkResponse({ description: "Hierarchical lineage graph with inbreeding analysis" })
  @ApiNotFoundResponse({ description: "Animal not found in this farm" })
  @ApiForbiddenResponse({ description: "Access denied to target farm" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid JWT token" })
  public async getAnimalLineage(
    @CurrentFarm("id") farmId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Query() query: AnimalLineageQueryDto
  ): Promise<AnimalLineageDto> {
    return this.animalsService.getAnimalLineage(id, farmId, query.generations);
  }

  @Get(":id")
  @FarmRoles(
    FarmRole.OWNER,
    FarmRole.MANAGER,
    FarmRole.HERDSMAN,
    FarmRole.VET_STAFF
  )
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("Animal retrieved successfully")
  @ApiOperation({ summary: "Get single animal by ID with lineage summary" })
  @ApiOkResponse({ description: "Animal profile retrieved" })
  @ApiNotFoundResponse({ description: "Animal not found in this farm" })
  @ApiForbiddenResponse({ description: "Access denied to target farm" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid JWT token" })
  public async getAnimalById(
    @CurrentFarm("id") farmId: string,
    @Param("id", ParseUUIDPipe) id: string
  ): Promise<AnimalResponseDto> {
    return this.animalsService.getAnimalById(id, farmId);
  }

  @Patch(":id")
  @FarmRoles(
    FarmRole.OWNER,
    FarmRole.MANAGER,
    FarmRole.HERDSMAN,
    FarmRole.VET_STAFF
  )
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("Animal updated successfully")
  @ApiOperation({ summary: "Update animal record details" })
  @ApiOkResponse({ description: "Animal updated successfully" })
  @ApiConflictResponse({ description: "Updated tag number already in use" })
  @ApiNotFoundResponse({ description: "Animal or parent pedigree not found" })
  @ApiUnprocessableEntityResponse({ description: "Validation error" })
  @ApiForbiddenResponse({ description: "Insufficient permissions" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid JWT token" })
  public async updateAnimal(
    @CurrentFarm("id") farmId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateAnimalDto,
    @CurrentUser() user: JwtPayload,
    @Headers("x-trace-id") traceId?: string
  ): Promise<AnimalResponseDto> {
    return this.animalsService.updateAnimal(
      id,
      farmId,
      dto,
      user.sub,
      traceId
    );
  }

  @Delete(":id")
  @FarmRoles(FarmRole.OWNER, FarmRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("Animal archived successfully")
  @ApiOperation({
    summary: "Soft delete / archive an animal (Owner/Manager only)",
  })
  @ApiOkResponse({ description: "Animal archived successfully" })
  @ApiNotFoundResponse({ description: "Animal not found in this farm" })
  @ApiForbiddenResponse({
    description: "Requires FarmRole OWNER or MANAGER",
  })
  @ApiUnauthorizedResponse({ description: "Missing or invalid JWT token" })
  public async archiveAnimal(
    @CurrentFarm("id") farmId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Headers("x-trace-id") traceId?: string
  ): Promise<AnimalResponseDto> {
    return this.animalsService.archiveAnimal(id, farmId, user.sub, traceId);
  }

  @Post(":id/weights")
  @FarmRoles(
    FarmRole.OWNER,
    FarmRole.MANAGER,
    FarmRole.HERDSMAN,
    FarmRole.VET_STAFF
  )
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage("Weight measurement recorded successfully")
  @ApiOperation({ summary: "Record body weight measurement for an animal" })
  @ApiCreatedResponse({ description: "Weight log created and current weight synced" })
  @ApiNotFoundResponse({ description: "Animal not found in this farm" })
  @ApiForbiddenResponse({ description: "Access denied to target farm" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid JWT token" })
  public async recordWeight(
    @CurrentFarm("id") farmId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: RecordWeightRequestDto,
    @CurrentUser() user: JwtPayload,
    @Headers("x-trace-id") traceId?: string
  ): Promise<AnimalWeightLogDto> {
    return this.animalsService.recordWeight(
      id,
      farmId,
      dto,
      user.sub,
      traceId
    );
  }

  @Get(":id/weights")
  @FarmRoles(
    FarmRole.OWNER,
    FarmRole.MANAGER,
    FarmRole.HERDSMAN,
    FarmRole.VET_STAFF
  )
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("Weight history retrieved successfully")
  @ApiOperation({ summary: "Get paginated chronological weight history for an animal" })
  @ApiOkResponse({ description: "Weight history logs" })
  @ApiNotFoundResponse({ description: "Animal not found in this farm" })
  @ApiForbiddenResponse({ description: "Access denied to target farm" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid JWT token" })
  public async getWeightHistory(
    @CurrentFarm("id") farmId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Query() query: WeightHistoryQueryRequestDto
  ): Promise<PaginatedWeightLogsDto> {
    return this.animalsService.getWeightHistory(id, farmId, query);
  }

  @Get(":id/growth-curve")
  @FarmRoles(
    FarmRole.OWNER,
    FarmRole.MANAGER,
    FarmRole.HERDSMAN,
    FarmRole.VET_STAFF
  )
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("Growth curve analytics retrieved successfully")
  @ApiOperation({ summary: "Get automated growth curve and ADG analytics for an animal" })
  @ApiOkResponse({ description: "Growth curve points and trajectory analysis" })
  @ApiNotFoundResponse({ description: "Animal not found in this farm" })
  @ApiForbiddenResponse({ description: "Access denied to target farm" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid JWT token" })
  public async getGrowthCurve(
    @CurrentFarm("id") farmId: string,
    @Param("id", ParseUUIDPipe) id: string
  ): Promise<GrowthCurveAnalyticsDto> {
    return this.animalsService.getGrowthCurve(id, farmId);
  }

  @Delete(":id/weights/:weightId")
  @FarmRoles(FarmRole.OWNER, FarmRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("Weight log deleted successfully")
  @ApiOperation({ summary: "Delete a weight measurement entry (Owner/Manager only)" })
  @ApiOkResponse({ description: "Weight log removed and current weight recalibrated" })
  @ApiNotFoundResponse({ description: "Animal or weight log not found" })
  @ApiForbiddenResponse({ description: "Requires FarmRole OWNER or MANAGER" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid JWT token" })
  public async deleteWeightLog(
    @CurrentFarm("id") farmId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("weightId", ParseUUIDPipe) weightId: string,
    @CurrentUser() user: JwtPayload,
    @Headers("x-trace-id") traceId?: string
  ): Promise<{ message: string }> {
    await this.animalsService.deleteWeightLog(
      id,
      weightId,
      farmId,
      user.sub,
      traceId
    );
    return { message: "Weight log deleted successfully" };
  }
}
