import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Put,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  AdminCurriculumWrite, adminCurriculumWriteSchema,
  AdminProductCreate,
  AdminProductEdit,
  AdminProductAction,
  AdminProductQuery,
  adminProductCreateSchema,
  adminProductEditSchema,
  adminProductActionSchema,
  adminProductQuerySchema,
  JwtPayload,
  UserRole,
} from "@vetralink/shared-types";
import { CurrentUser, Roles } from "../../common/decorators";
import { JwtAuthGuard, RolesGuard } from "../../common/guards";
import { SchemaValidationPipe } from "../../common/pipes/schema-validation.pipe";
import { AdminCourseCurriculumService } from "./admin-course-curriculum.service";
import { AdminProductsService } from "./admin-products.service";
@ApiTags("Admin products")
@ApiBearerAuth()
@Controller("admin/products")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminProductsController {
  constructor(private readonly products: AdminProductsService, private readonly curriculum: AdminCourseCurriculumService) {}
  @Get(":id/curriculum") getCurriculum(@CurrentUser() u: JwtPayload, @Param("id", ParseUUIDPipe) id: string) { return this.curriculum.detail(u,id); }
  @Put(":id/curriculum") replaceCurriculum(@CurrentUser() u: JwtPayload, @Param("id", ParseUUIDPipe) id: string, @Body(new SchemaValidationPipe(adminCurriculumWriteSchema,512*1024)) input: AdminCurriculumWrite) { return this.curriculum.replace(u,id,input); }
  @Get() list(
    @CurrentUser() u: JwtPayload,
    @Query(new SchemaValidationPipe(adminProductQuerySchema))
    q: AdminProductQuery,
  ) {
    return this.products.list(u, q);
  }
  @Get(":id") detail(
    @CurrentUser() u: JwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.products.detail(u, id);
  }
  @Post() create(
    @CurrentUser() u: JwtPayload,
    @Body(new SchemaValidationPipe(adminProductCreateSchema))
    input: AdminProductCreate,
  ) {
    return this.products.create(u, input);
  }
  @Patch(":id") edit(
    @CurrentUser() u: JwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new SchemaValidationPipe(adminProductEditSchema))
    input: AdminProductEdit,
  ) {
    return this.products.edit(u, id, input);
  }
  @Post(":id/actions") action(
    @CurrentUser() u: JwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new SchemaValidationPipe(adminProductActionSchema))
    input: AdminProductAction,
  ) {
    return this.products.action(u, id, input);
  }
}
