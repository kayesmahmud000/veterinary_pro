import { Body,Controller,Get,Param,ParseUUIDPipe,Post,Query,UseGuards } from '@nestjs/common';
import { ApiBearerAuth,ApiTags } from '@nestjs/swagger';
import { JwtPayload,UserRole,AdminSettlementQuery,AdminSettlementReconcile,AdminSettlementBulk,adminSettlementQuerySchema,adminSettlementSummaryQuerySchema,adminSettlementReconcileSchema,adminSettlementBulkSchema } from '@vetralink/shared-types';
import { CurrentUser,Roles } from '../../common/decorators';
import { JwtAuthGuard,RolesGuard } from '../../common/guards';
import { SchemaValidationPipe } from '../../common/pipes/schema-validation.pipe';
import { AdminSettlementsService } from './settlements.service';
@ApiTags('Administrative settlements')
@ApiBearerAuth()
@Controller('admin/settlements')
@UseGuards(JwtAuthGuard,RolesGuard)
@Roles(UserRole.ADMIN,UserRole.SUPER_ADMIN)
export class AdminSettlementsController {
 constructor(private readonly settlements:AdminSettlementsService){}
 @Get() list(@CurrentUser()claims:JwtPayload,@Query(new SchemaValidationPipe(adminSettlementQuerySchema))query:AdminSettlementQuery){return this.settlements.list(claims,query);}
 @Get('summary') summary(@CurrentUser()claims:JwtPayload,@Query(new SchemaValidationPipe(adminSettlementSummaryQuerySchema))query:Partial<AdminSettlementQuery>){return this.settlements.summary(claims,query);}
 @Get(':id') detail(@CurrentUser()claims:JwtPayload,@Param('id',ParseUUIDPipe)id:string){return this.settlements.detail(claims,id);}
 @Get(':id/preview') preview(@CurrentUser()claims:JwtPayload,@Param('id',ParseUUIDPipe)id:string){return this.settlements.preview(claims,id);}
 @Post('bulk-reconcile') bulk(@CurrentUser()claims:JwtPayload,@Body(new SchemaValidationPipe(adminSettlementBulkSchema,32768))input:AdminSettlementBulk){return this.settlements.bulk(claims,input);}
 @Post(':id/reconcile') reconcile(@CurrentUser()claims:JwtPayload,@Param('id',ParseUUIDPipe)id:string,@Body(new SchemaValidationPipe(adminSettlementReconcileSchema,16384))input:AdminSettlementReconcile){return this.settlements.reconcile(claims,id,input);}
}
