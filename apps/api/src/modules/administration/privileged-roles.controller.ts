import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  JwtPayload,
  PrivilegedRoleInput,
  privilegedRoleSchema,
  UserRole,
} from "@vetralink/shared-types";
import { z } from "zod";
import { CurrentUser, Roles } from "../../common/decorators";
import { JwtAuthGuard, RolesGuard } from "../../common/guards";
import { SchemaValidationPipe } from "../../common/pipes/schema-validation.pipe";
import { PrivilegedRoleService } from "./privileged-role.service";
const querySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: z.string().uuid().optional(),
    role: z.enum([UserRole.ADMIN, UserRole.SUPER_ADMIN]).optional(),
    search: z.string().trim().max(100).optional(),
  })
  .strict();
const lookupSchema = z
  .object({ email: z.string().trim().toLowerCase().email().max(254) })
  .strict();
@ApiTags("Administrative access")
@ApiBearerAuth()
@Controller("admin/users")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class PrivilegedRolesController {
  constructor(private readonly roles: PrivilegedRoleService) {}
  @Get("administrative-access")
  list(
    @CurrentUser() user: JwtPayload,
    @Query(new SchemaValidationPipe(querySchema))
    query: z.infer<typeof querySchema>,
  ) {
    return this.roles.list(user.sub, query);
  }
  @Get("role-access")
  lookup(
    @CurrentUser() user: JwtPayload,
    @Query(new SchemaValidationPipe(lookupSchema))
    query: z.infer<typeof lookupSchema>,
  ) {
    return this.roles.targetByEmail(user.sub, query.email);
  }
  @Get(":id/role-access")
  target(
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.roles.target(user.sub, id);
  }
  @Patch(":id/privileged-role")
  change(
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new SchemaValidationPipe(privilegedRoleSchema))
    input: PrivilegedRoleInput,
  ) {
    return this.roles.change(user.sub, id, input);
  }
}
