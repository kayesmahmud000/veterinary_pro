import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import {
  JwtPayload,
  UserRole,
  PlatformSettingsSave,
  PlatformReportQuery,
  platformSettingsSaveSchema,
  platformDiagnosticSchema,
  platformReportQuerySchema,
  platformReportExportSchema,
  platformAuditExportSchema,
} from "@vetralink/shared-types";
import { CurrentUser, Roles } from "../../common/decorators";
import { JwtAuthGuard, RolesGuard } from "../../common/guards";
import { SchemaValidationPipe } from "../../common/pipes/schema-validation.pipe";
import { PlatformService } from "./platform.service";

@ApiTags("Platform administration")
@ApiBearerAuth()
@Controller("admin/platform")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class PlatformController {
  constructor(private readonly service: PlatformService) {}
  @Get("settings") settings(@CurrentUser() user: JwtPayload) {
    return this.service.settings(user);
  }
  @Post("settings") save(
    @CurrentUser() user: JwtPayload,
    @Body(new SchemaValidationPipe(platformSettingsSaveSchema, 16384))
    input: PlatformSettingsSave,
  ) {
    return this.service.saveSettings(user, input);
  }
  @Get("integrations") integrations(@CurrentUser() user: JwtPayload) {
    return this.service.integrations(user);
  }
  @Get("system") system(@CurrentUser() user: JwtPayload) {
    return this.service.system(user);
  }
  @Post("diagnostics") diagnostics(
    @CurrentUser() user: JwtPayload,
    @Body(new SchemaValidationPipe(platformDiagnosticSchema, 16384))
    input: z.infer<typeof platformDiagnosticSchema>,
  ) {
    return this.service.diagnostics(user, input);
  }
  @Get("reports")
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  report(
    @CurrentUser() user: JwtPayload,
    @Query(new SchemaValidationPipe(platformReportQuerySchema))
    query: PlatformReportQuery,
  ) {
    return this.service.report(user, query);
  }
  @Post("reports/export")
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  exportReport(
    @CurrentUser() user: JwtPayload,
    @Body(new SchemaValidationPipe(platformReportExportSchema, 16384))
    input: z.infer<typeof platformReportExportSchema>,
  ) {
    return this.service.exportReport(user, input);
  }
  @Post("audit-export")
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  exportAudit(
    @CurrentUser() user: JwtPayload,
    @Body(new SchemaValidationPipe(platformAuditExportSchema, 16384))
    input: z.infer<typeof platformAuditExportSchema>,
  ) {
    return this.service.exportAudit(user, input);
  }
}
