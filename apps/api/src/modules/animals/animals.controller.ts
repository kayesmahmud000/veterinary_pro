import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from "@nestjs/swagger";
import {
  AnimalResponseDto,
  FarmRole,
  JwtPayload,
  PaginatedAnimalsDto,
  TagAvailabilityResponseDto,
} from "@vetralink/shared-types";
import {
  CurrentFarm,
  CurrentUser,
  FarmRoles,
  ResponseMessage,
  Tenant,
} from "../../common/decorators";
import { JwtAuthGuard, TenantGuard } from "../../common/guards";
import {
  ANIMALS_SERVICE,
  IAnimalsService,
} from "./services/animals.service.interface";
import {
  AnimalQueryDto,
  CheckTagAvailabilityQueryDto,
  RegisterAnimalDto,
  UpdateAnimalDto,
} from "./dto";

@ApiTags("Animals")
@Controller("animals")
@UseGuards(JwtAuthGuard, TenantGuard)
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
    private readonly animalsService: IAnimalsService
  ) {}

  @Post()
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
}
