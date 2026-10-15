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
  AccountActionInput,
  accountActionSchema,
  DirectoryKind,
  directoryKinds,
  directoryQueries,
  JwtPayload,
  UserRole,
} from "@vetralink/shared-types";
import { CurrentUser, Roles } from "../../common/decorators";
import { JwtAuthGuard, RolesGuard } from "../../common/guards";
import { SchemaValidationPipe } from "../../common/pipes/schema-validation.pipe";
import { DirectoryService } from "./directory.service";
@ApiTags("Administrative directories")
@ApiBearerAuth()
@Controller("admin/directory")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class DirectoryController {
  constructor(private readonly directory: DirectoryService) {}
  @Post("users/:id/actions")
  action(
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new SchemaValidationPipe(accountActionSchema))
    input: AccountActionInput,
  ) {
    return this.directory.act(user, id, input);
  }
  @Get(":kind")
  list(
    @CurrentUser() user: JwtPayload,
    @Param("kind", new SchemaValidationPipe(z.enum(directoryKinds)))
    kind: DirectoryKind,
    @Query() query: Record<string, unknown>,
  ) {
    return this.directory.list(
      user,
      kind,
      new SchemaValidationPipe(directoryQueries[kind]).transform(query),
    );
  }
  @Get(":kind/:id")
  detail(
    @CurrentUser() user: JwtPayload,
    @Param("kind", new SchemaValidationPipe(z.enum(directoryKinds)))
    kind: DirectoryKind,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.directory.detail(user, kind, id);
  }
}
