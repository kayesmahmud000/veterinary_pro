import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import {
  JwtPayload,
  ProfessionalRole,
  RoleDecisionInput,
  RoleRequestStatus,
  roleDecisionSchema,
  SubmitRoleRequestInput,
  submitRoleRequestSchema,
  UserRole,
} from "@vetralink/shared-types";
import { CurrentUser, Roles } from "../../common/decorators";
import { JwtAuthGuard, RolesGuard } from "../../common/guards";
import { SchemaValidationPipe } from "../../common/pipes/schema-validation.pipe";
import { RoleRequestService } from "./services/role-request.service";
import { questionnaires } from "./questionnaires";

const querySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: z.string().uuid().optional(),
    status: z.nativeEnum(RoleRequestStatus).optional(),
    targetRole: z.nativeEnum(ProfessionalRole).optional(),
  })
  .strict();
@ApiTags("Role applications")
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class RoleRequestsController {
  constructor(private readonly applications: RoleRequestService) {}
  @Get("role-requests/questionnaires/:targetRole")
  questionnaire(
    @Param(
      "targetRole",
      new SchemaValidationPipe(z.nativeEnum(ProfessionalRole)),
    )
    role: ProfessionalRole,
  ) {
    return { targetRole: role, ...questionnaires[role] };
  }
  @Post("users/me/role-requests")
  @Roles(UserRole.LEARNER)
  submit(
    @CurrentUser() user: JwtPayload,
    @Body(new SchemaValidationPipe(submitRoleRequestSchema))
    input: SubmitRoleRequestInput,
  ) {
    return this.applications.submit(user.sub, input);
  }
  @Get("users/me/role-requests")
  mine(
    @CurrentUser() user: JwtPayload,
    @Query(new SchemaValidationPipe(querySchema))
    query: z.infer<typeof querySchema>,
  ) {
    return this.applications.mine(user.sub, query);
  }
  @Get("users/me/role-requests/:id")
  own(@CurrentUser() user: JwtPayload, @Param("id", ParseUUIDPipe) id: string) {
    return this.applications.own(user.sub, id);
  }
  @Get("admin/role-requests")
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  queue(
    @CurrentUser() user: JwtPayload,
    @Query(new SchemaValidationPipe(querySchema))
    query: z.infer<typeof querySchema>,
  ) {
    return this.applications.queue(user.sub, query);
  }
  @Get("admin/role-requests/:id")
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  detail(
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.applications.detail(user.sub, id);
  }
  @Post("admin/role-requests/:id/decision")
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  decide(
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new SchemaValidationPipe(roleDecisionSchema))
    input: RoleDecisionInput,
  ) {
    return this.applications.decide(user.sub, id, input);
  }
}
