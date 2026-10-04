import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import {
  FarmMemberListDto,
  FarmMemberResponseDto,
  FarmRole,
  SubscriptionQuotaType,
} from "@vetralink/shared-types";
import {
  CheckQuota,
  FarmRoles,
  ResponseMessage,
  Tenant,
} from "../../common/decorators";
import {
  JwtAuthGuard,
  SubscriptionQuotaGuard,
  TenantGuard,
} from "../../common/guards";
import { AddFarmMemberDto } from "./dto";
import {
  FARM_MEMBERS_SERVICE,
  IFarmMembersService,
} from "./services/farm-members.service.interface";

@ApiTags("Farms")
@Controller("farms")
@UseGuards(JwtAuthGuard, TenantGuard, SubscriptionQuotaGuard)
@Tenant()
@ApiBearerAuth()
@ApiHeader({
  name: "x-farm-id",
  required: false,
  description: "Target farm tenant UUID (or resolved via route param :farmId)",
})
export class FarmMembersController {
  constructor(
    @Inject(FARM_MEMBERS_SERVICE)
    private readonly farmMembersService: IFarmMembersService,
  ) {}

  @Post(":farmId/members")
  @FarmRoles(FarmRole.OWNER, FarmRole.MANAGER)
  @CheckQuota(SubscriptionQuotaType.STAFF)
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage("Farm member added successfully")
  @ApiOperation({
    summary: "Add or invite a staff member to the farm tenant",
    description: "Enforces subscription tier staff quotas (Starter: 1, Pro: 3, Enterprise: Unlimited)",
  })
  @ApiCreatedResponse({ description: "Farm member added successfully" })
  @ApiConflictResponse({ description: "User is already a member of this farm" })
  @ApiForbiddenResponse({
    description: "Quota exceeded or insufficient farm role permissions",
  })
  @ApiUnauthorizedResponse({ description: "Missing or invalid JWT token" })
  public async addMember(
    @Param("farmId", ParseUUIDPipe) farmId: string,
    @Body() dto: AddFarmMemberDto,
  ): Promise<FarmMemberResponseDto> {
    return this.farmMembersService.addMember(farmId, dto);
  }

  @Get(":farmId/members")
  @FarmRoles(
    FarmRole.OWNER,
    FarmRole.MANAGER,
    FarmRole.HERDSMAN,
    FarmRole.VET_STAFF,
  )
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("Farm members retrieved successfully")
  @ApiOperation({
    summary: "List all members belonging to the farm tenant",
  })
  @ApiOkResponse({ description: "List of farm members" })
  @ApiForbiddenResponse({ description: "Access denied to target farm" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid JWT token" })
  public async getMembers(
    @Param("farmId", ParseUUIDPipe) farmId: string,
  ): Promise<FarmMemberListDto> {
    return this.farmMembersService.getMembers(farmId);
  }
}
