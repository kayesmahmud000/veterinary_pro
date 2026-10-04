import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import {
  JwtPayload,
  SyncPullResponseDto,
  SyncPushResponseDto,
  SyncStatusDto,
  UserRole,
} from "@vetralink/shared-types";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../../common/guards/roles.guard";
import { SyncPullDto, SyncPushDto } from "../dto";
import {
  ISyncService,
  SYNC_SERVICE,
} from "../services/sync.service.interface";

@ApiTags("Offline Synchronization")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("sync")
export class SyncController {
  constructor(
    @Inject(SYNC_SERVICE)
    private readonly syncService: ISyncService
  ) {}

  @Post("pull")
  @Roles(
    UserRole.FARMER,
    UserRole.VET,
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN
  )
  @ApiOperation({
    summary: "Pull incremental delta changes for mobile/offline synchronization",
    description:
      "Returns created, updated, and deleted records for the specified farm since the last pulled watermark.",
  })
  @ApiResponse({
    status: 200,
    description: "Delta changes retrieved successfully.",
  })
  public async pull(
    @CurrentUser() user: JwtPayload,
    @Body() dto: SyncPullDto
  ): Promise<SyncPullResponseDto> {
    return this.syncService.pull(user, dto.farmId, dto.lastPulledAt);
  }

  @Post("push")
  @Roles(
    UserRole.FARMER,
    UserRole.VET,
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN
  )
  @ApiOperation({
    summary: "Push batch of offline mutations to the server",
    description:
      "Applies created, updated, and deleted entities recorded offline in an atomic transaction with Last-Write-Wins conflict resolution.",
  })
  @ApiResponse({
    status: 200,
    description: "Mutations processed successfully.",
  })
  public async push(
    @CurrentUser() user: JwtPayload,
    @Body() dto: SyncPushDto,
    @Headers("x-trace-id") traceId?: string
  ): Promise<SyncPushResponseDto> {
    return this.syncService.push(user, dto, traceId);
  }

  @Get("status/:farmId")
  @Roles(
    UserRole.FARMER,
    UserRole.VET,
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN
  )
  @ApiOperation({
    summary: "Get farm sync summary and active entity counts",
    description:
      "Returns total counts of syncable entities on the farm and current server timestamp.",
  })
  @ApiResponse({
    status: 200,
    description: "Sync status retrieved successfully.",
  })
  public async getStatus(
    @CurrentUser() user: JwtPayload,
    @Param("farmId") farmId: string
  ): Promise<SyncStatusDto> {
    return this.syncService.getStatus(user, farmId);
  }
}
