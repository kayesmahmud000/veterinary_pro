import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import {
  BillingKind,
  BillingQuery,
  BillingPlanEdit,
  BillingSubscriptionAction,
  billingKinds,
  billingQueries,
  billingPlanEditSchema,
  billingSubscriptionActionSchema,
  JwtPayload,
  UserRole,
} from "@vetralink/shared-types";
import { CurrentUser, Roles } from "../../common/decorators";
import { JwtAuthGuard, RolesGuard } from "../../common/guards";
import { SchemaValidationPipe } from "../../common/pipes/schema-validation.pipe";
import { BillingService } from "./billing.service";
@ApiTags("Administrative billing")
@ApiBearerAuth()
@Controller("admin/billing")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class BillingController {
  constructor(private readonly billing: BillingService) {}
  @Get(":kind")
  @ApiOperation({
    summary:
      "List administrative billing records without provider side effects",
  })
  list(
    @CurrentUser() user: JwtPayload,
    @Param("kind", new SchemaValidationPipe(z.enum(billingKinds)))
    kind: BillingKind,
    @Query() query: Record<string, unknown>,
  ) {
    return this.billing.list(
      user,
      kind,
      new SchemaValidationPipe<BillingQuery>(billingQueries[kind]).transform(
        query,
      ),
    );
  }
  @Get(":kind/:id")
  @ApiOperation({ summary: "Read redacted billing detail and bounded history" })
  detail(
    @CurrentUser() user: JwtPayload,
    @Param("kind", new SchemaValidationPipe(z.enum(billingKinds)))
    kind: BillingKind,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.billing.detail(user, kind, id);
  }
  @Post("subscriptions/:id/actions")
  @ApiOperation({
    summary: "Confirm a supported local period-end cancellation change",
  })
  action(
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new SchemaValidationPipe(billingSubscriptionActionSchema, 16384))
    input: BillingSubscriptionAction,
  ) {
    return this.billing.action(user, id, input);
  }
  @Patch("plans/:id")
  @ApiOperation({
    summary: "Confirm a local subscription plan catalogue update",
  })
  edit(
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new SchemaValidationPipe(billingPlanEditSchema, 16384))
    input: BillingPlanEdit,
  ) {
    return this.billing.editPlan(user, id, input);
  }
}
