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
  AdminReviewModerate,
  AdminReviewQuery,
  JwtPayload,
  UserRole,
  adminReviewModerateSchema,
  adminReviewQuerySchema,
} from "@vetralink/shared-types";
import { CurrentUser, Roles } from "../../common/decorators";
import { JwtAuthGuard, RolesGuard } from "../../common/guards";
import { SchemaValidationPipe } from "../../common/pipes/schema-validation.pipe";
import { AdminReviewsService } from "./reviews.service";
@ApiTags("Administrative reviews")
@ApiBearerAuth()
@Controller("admin/reviews")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminReviewsController {
  constructor(private readonly consultations: AdminReviewsService) {}
  @Get()
  @ApiOperation({
    summary: "Discover reviews with safe bounded operational projections",
  })
  list(
    @CurrentUser() user: JwtPayload,
    @Query(new SchemaValidationPipe(adminReviewQuerySchema))
    query: AdminReviewQuery,
  ) {
    return this.consultations.list(user, query);
  }
  @Get(":id")
  @ApiOperation({
    summary: "Read a repeatable review snapshot without clinical/provider data",
  })
  detail(
    @CurrentUser() user: JwtPayload,
    @Param("id", new SchemaValidationPipe(z.string().uuid().toLowerCase()))
    id: string,
    @Query(new SchemaValidationPipe(z.object({}).strict())) _query: unknown,
  ) {
    return this.consultations.detail(user, id);
  }
  @Post(":id/moderate")
  @ApiOperation({
    summary: "Password-confirm a revision-checked review moderation",
  })
  moderate(
    @CurrentUser() user: JwtPayload,
    @Param("id", new SchemaValidationPipe(z.string().uuid().toLowerCase()))
    id: string,
    @Body(new SchemaValidationPipe(adminReviewModerateSchema, 16384))
    input: AdminReviewModerate,
  ) {
    return this.consultations.moderate(user, id, input);
  }
}
