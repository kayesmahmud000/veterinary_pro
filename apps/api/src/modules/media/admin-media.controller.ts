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
  adminUploadCreateSchema,
  AdminUploadCreate,
  adminUploadQuerySchema,
  adminPartSchema,
  adminCompleteSchema,
  adminAssetAttachSchema,
  JwtPayload,
  UserRole,
} from "@vetralink/shared-types";
import { CurrentUser, Roles } from "../../common/decorators";
import { JwtAuthGuard, RolesGuard } from "../../common/guards";
import { SchemaValidationPipe } from "../../common/pipes/schema-validation.pipe";
import { AdminMediaService } from "./admin-media.service";
@ApiTags("Admin media")
@ApiBearerAuth()
@Controller("admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminMediaController {
  constructor(private readonly media: AdminMediaService) {}
  @Get("media") list(
    @CurrentUser() u: JwtPayload,
    @Query(new SchemaValidationPipe(adminUploadQuerySchema))
    q: z.infer<typeof adminUploadQuerySchema>,
  ) {
    return this.media.list(u, q);
  }
  @Post("media/uploads") initiate(
    @CurrentUser() u: JwtPayload,
    @Body(new SchemaValidationPipe(adminUploadCreateSchema))
    v: AdminUploadCreate,
  ) {
    return this.media.initiate(u, v);
  }
  @Get("media/uploads/:id") detail(
    @CurrentUser() u: JwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.media.detail(u, id);
  }
  @Post("media/uploads/:id/part-url") part(
    @CurrentUser() u: JwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new SchemaValidationPipe(adminPartSchema))
    v: z.infer<typeof adminPartSchema>,
  ) {
    return this.media.part(u, id, v);
  }
  @Post("media/uploads/:id/complete") complete(
    @CurrentUser() u: JwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new SchemaValidationPipe(adminCompleteSchema))
    v: z.infer<typeof adminCompleteSchema>,
  ) {
    return this.media.complete(u, id, v);
  }
  @Post("media/uploads/:id/abort") abort(
    @CurrentUser() u: JwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.media.abort(u, id);
  }
  @Post("media/uploads/:id/process") process(
    @CurrentUser() u: JwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.media.process(u, id);
  }
  @Post("products/:id/asset") attach(
    @CurrentUser() u: JwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new SchemaValidationPipe(adminAssetAttachSchema))
    v: z.infer<typeof adminAssetAttachSchema>,
  ) {
    return this.media.attach(u, id, v);
  }
}
