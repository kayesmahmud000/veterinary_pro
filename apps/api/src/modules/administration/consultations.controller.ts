import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import {
  AdminConsultationAction,
  AdminConsultationQuery,
  JwtPayload,
  UserRole,
  adminConsultationActionSchema,
  adminConsultationQuerySchema,
} from "@vetralink/shared-types";
import { CurrentUser, Roles } from "../../common/decorators";
import { JwtAuthGuard, RolesGuard } from "../../common/guards";
import { SchemaValidationPipe } from "../../common/pipes/schema-validation.pipe";
import { AdminConsultationsService } from "./consultations.service";
@ApiTags("Administrative consultations")
@ApiBearerAuth()
@Controller("admin/consultations")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminConsultationsController {
  constructor(private readonly consultations: AdminConsultationsService) {}
  @Get()
  @ApiOperation({
    summary: "Discover consultations with safe bounded operational projections",
  })
  list(
    @CurrentUser() user: JwtPayload,
    @Query(new SchemaValidationPipe(adminConsultationQuerySchema))
    query: AdminConsultationQuery,
  ) {
    return this.consultations.list(user, query);
  }
  @Get(":id")
  @ApiOperation({
    summary:
      "Read a repeatable consultation snapshot without clinical/provider data",
  })
  detail(
    @CurrentUser() user: JwtPayload,
    @Param("id", new SchemaValidationPipe(z.string().uuid())) id: string,
    @Query(new SchemaValidationPipe(z.object({}).strict())) _query: unknown,
  ) {
    return this.consultations.detail(user, id);
  }
  @Get(":id/candidates")
  @ApiOperation({
    summary: "Read at most 100 ranked active veterinarian candidates",
  })
  candidates(
    @CurrentUser() user: JwtPayload,
    @Param("id", new SchemaValidationPipe(z.string().uuid())) id: string,
    @Query(new SchemaValidationPipe(z.object({}).strict())) _query: unknown,
  ) {
    return this.consultations.candidates(user, id);
  }
  @Post(":id/actions")
  @ApiOperation({
    summary:
      "Password-confirm a revision-checked assignment or safe local cancellation",
  })
  action(
    @CurrentUser() user: JwtPayload,
    @Param("id", new SchemaValidationPipe(z.string().uuid())) id: string,
    @Body(new SchemaValidationPipe(adminConsultationActionSchema, 16384))
    input: AdminConsultationAction,
  ) {
    return this.consultations.action(user, id, input);
  }
}
