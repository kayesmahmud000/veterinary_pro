import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  FarmOnboardingInput,
  farmOnboardingSchema,
  JwtPayload,
  UserRole,
} from "@vetralink/shared-types";
import { CurrentUser, Roles } from "../../common/decorators";
import { JwtAuthGuard, RolesGuard } from "../../common/guards";
import { SchemaValidationPipe } from "../../common/pipes/schema-validation.pipe";
import { FarmOnboardingService } from "./services/farm-onboarding.service";

@ApiTags("Farm onboarding")
@ApiBearerAuth()
@Controller("farms")
@UseGuards(JwtAuthGuard, RolesGuard)
export class FarmOnboardingController {
  constructor(private readonly onboarding: FarmOnboardingService) {}
  @Get("onboarding")
  @Roles(UserRole.FARMER)
  status(@CurrentUser() user: JwtPayload) {
    return this.onboarding.status(user.sub);
  }
  @Post("onboarding")
  @Roles(UserRole.FARMER)
  complete(
    @CurrentUser() user: JwtPayload,
    @Body(new SchemaValidationPipe(farmOnboardingSchema))
    input: FarmOnboardingInput,
  ) {
    return this.onboarding.complete(user.sub, input);
  }
  @Get("my")
  @Roles(
    UserRole.FARMER,
    UserRole.VET,
    UserRole.BUYER,
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
  )
  farms(@CurrentUser() user: JwtPayload) {
    return this.onboarding.status(user.sub);
  }
}
