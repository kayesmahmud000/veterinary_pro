import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import {
  JwtPayload,
  UserRole,
  EditorialCreate,
  EditorialSave,
  EditorialAction,
  EditorialQuery,
  NotificationQuery,
  NotificationRetry,
  SupportQuery,
  SupportCreate,
  SupportReply,
  SupportAction,
  editorialCreateSchema,
  editorialSaveSchema,
  editorialActionSchema,
  editorialQuerySchema,
  editorialKindSchema,
  editorialSlugSchema,
  communicationsQuerySchema,
  notificationQuerySchema,
  notificationRetrySchema,
  supportQuerySchema,
  supportCreateSchema,
  supportReplySchema,
  supportActionSchema,
} from "@vetralink/shared-types";
import { CurrentUser, Roles } from "../../common/decorators";
import { JwtAuthGuard, RolesGuard } from "../../common/guards";
import { SchemaValidationPipe } from "../../common/pipes/schema-validation.pipe";
import { CommunicationsService } from "./communications.service";
const idPipe = new SchemaValidationPipe(z.string().uuid().toLowerCase());
const empty = new SchemaValidationPipe(z.object({}).strict());
@ApiTags("Administrative communications")
@ApiBearerAuth()
@Controller("admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class CommunicationsController {
  constructor(private readonly service: CommunicationsService) {}
  @Get("content") list(
    @CurrentUser() u: JwtPayload,
    @Query(new SchemaValidationPipe(editorialQuerySchema)) q: EditorialQuery,
  ) {
    return this.service.listContent(u, q);
  }
  @Post("content") create(
    @CurrentUser() u: JwtPayload,
    @Body(new SchemaValidationPipe(editorialCreateSchema, 262144))
    b: EditorialCreate,
  ) {
    return this.service.createContent(u, b);
  }
  @Get("content/:id") detail(
    @CurrentUser() u: JwtPayload,
    @Param("id", idPipe) id: string,
    @Query(empty) _q: unknown,
  ) {
    return this.service.content(u, id);
  }
  @Post("content/:id/save") save(
    @CurrentUser() u: JwtPayload,
    @Param("id", idPipe) id: string,
    @Body(new SchemaValidationPipe(editorialSaveSchema, 262144))
    b: EditorialSave,
  ) {
    return this.service.saveContent(u, id, b);
  }
  @Post("content/:id/actions") action(
    @CurrentUser() u: JwtPayload,
    @Param("id", idPipe) id: string,
    @Body(new SchemaValidationPipe(editorialActionSchema, 16384))
    b: EditorialAction,
  ) {
    return this.service.actionContent(u, id, b);
  }
  @Get("notifications") notifications(
    @CurrentUser() u: JwtPayload,
    @Query(new SchemaValidationPipe(notificationQuerySchema))
    q: NotificationQuery,
  ) {
    return this.service.notifications(u, q);
  }
  @Post("notifications/:id/retry") retry(
    @CurrentUser() u: JwtPayload,
    @Param("id", idPipe) id: string,
    @Body(new SchemaValidationPipe(notificationRetrySchema, 16384))
    b: NotificationRetry,
  ) {
    return this.service.retry(u, id, b);
  }
  @Get("support") supportList(
    @CurrentUser() u: JwtPayload,
    @Query(new SchemaValidationPipe(supportQuerySchema)) q: SupportQuery,
  ) {
    return this.service.listSupport(u, q, true);
  }
  @Get("support/:id") support(
    @CurrentUser() u: JwtPayload,
    @Param("id", idPipe) id: string,
    @Query(empty) _q: unknown,
  ) {
    return this.service.support(u, id, true);
  }
  @Post("support/:id/actions") supportAction(
    @CurrentUser() u: JwtPayload,
    @Param("id", idPipe) id: string,
    @Body(new SchemaValidationPipe(supportActionSchema, 32768))
    b: SupportAction,
  ) {
    return this.service.actionSupport(u, id, b);
  }
}
@ApiTags("Own support")
@ApiBearerAuth()
@Controller("support/tickets")
@UseGuards(JwtAuthGuard)
export class OwnSupportController {
  constructor(private readonly service: CommunicationsService) {}
  @Get() list(
    @CurrentUser() u: JwtPayload,
    @Query(new SchemaValidationPipe(supportQuerySchema)) q: SupportQuery,
  ) {
    return this.service.listSupport(u, q, false);
  }
  @Post() create(
    @CurrentUser() u: JwtPayload,
    @Body(new SchemaValidationPipe(supportCreateSchema, 32768))
    b: SupportCreate,
  ) {
    return this.service.createSupport(u, b);
  }
  @Get(":id") detail(
    @CurrentUser() u: JwtPayload,
    @Param("id", idPipe) id: string,
    @Query(empty) _q: unknown,
  ) {
    return this.service.support(u, id, false);
  }
  @Post(":id/messages") reply(
    @CurrentUser() u: JwtPayload,
    @Param("id", idPipe) id: string,
    @Body(new SchemaValidationPipe(supportReplySchema, 32768)) b: SupportReply,
  ) {
    return this.service.replySupport(u, id, b);
  }
}
@ApiTags("Published content")
@Controller("content")
export class PublicContentController {
  constructor(private readonly service: CommunicationsService) {}
  @Get(":kind") list(
    @Param("kind", new SchemaValidationPipe(editorialKindSchema))
    kind: z.infer<typeof editorialKindSchema>,
    @Query(new SchemaValidationPipe(communicationsQuerySchema))
    q: z.infer<typeof communicationsQuerySchema>,
  ) {
    return this.service.publicList(kind, q);
  }
  @Get(":kind/:slug") async detail(
    @Param("kind", new SchemaValidationPipe(editorialKindSchema)) kind: string,
    @Param("slug", new SchemaValidationPipe(editorialSlugSchema)) slug: string,
    @Query(empty) _q: unknown,
  ) {
    return this.service.publicContent(kind, slug);
  }
}
