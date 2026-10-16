import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { AdminSettlementQuery, adminSettlementRowSchema, adminSettlementDetailSchema, adminSettlementSummarySchema } from '@vetralink/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { settlementUnavailableReason } from '../consultations/entities/payout-ledger.entity';
const identitySelect = {select:{id:true,name:true,deletedAt:true}} as const;
const select = {id:true,consultationId:true,vetId:true,totalFeeCents:true,platformFeeRate:true,platformFeeCents:true,vetPayoutCents:true,currency:true,status:true,payoutReference:true,payoutBatchId:true,processedAt:true,createdAt:true,updatedAt:true,vet:identitySelect,consultation:{select:{id:true,vetId:true,status:true,paymentStatus:true,type:true,feeCents:true,currency:true,farmer:identitySelect,farm:identitySelect}}} as const;
const identity = (value:{id:string;name:string;deletedAt:Date|null}|null) => value && !value.deletedAt ? {id:value.id,name:value.name}:null;
const json = (value:unknown)=>JSON.parse(JSON.stringify(value));
const actions = ['VET_CONSULTATION_SETTLED','VET_PAYOUT_PROCESSED','VET_PAYOUT_BULK_PROCESSED','ADMIN_SETTLEMENT_RECONCILED','ADMIN_SETTLEMENT_BULK_RECONCILED'];
@Injectable()
export class AdminSettlementsRepository {
 constructor(private readonly prisma:PrismaService) {}
 private where(q:Partial<AdminSettlementQuery>):Prisma.ConsultationPayoutLedgerWhereInput {
  const term=q.search ? {contains:q.search,mode:'insensitive' as const}:undefined;
  const idSearch=q.search && /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(q.search) ? [{id:q.search},{consultationId:q.search}]:[];
  return {...(q.status?{status:q.status}:{}),...(q.vetId?{vetId:q.vetId}:{}),...(q.currency?{currency:q.currency}:{}),...(term?{OR:[...idSearch,{vet:{deletedAt:null,name:term}}]}:{})};
 }
 async revision(id:string,tx:Prisma.TransactionClient) {
  const rows=await tx.$queryRaw<Array<{ledger:string;consultation:string}>>(Prisma.sql`SELECT l.xmin::text AS ledger,c.xmin::text AS consultation FROM consultation_payout_ledgers l JOIN consultations c ON c.id=l.consultation_id WHERE l.id=${id}::uuid`);
  return rows[0]?createHash('sha256').update(`${id}:${rows[0].ledger}:${rows[0].consultation}`).digest('hex'):null;
 }
 private async project(row:Prisma.ConsultationPayoutLedgerGetPayload<{select:typeof select}>,tx:Prisma.TransactionClient) {
  return adminSettlementRowSchema.parse(json({id:row.id,consultationId:row.consultationId,vet:identity(row.vet),status:row.status,totalFeeCents:row.totalFeeCents,platformFeeRate:Number(row.platformFeeRate),platformFeeCents:row.platformFeeCents,vetPayoutCents:row.vetPayoutCents,currency:row.currency,processedAt:row.processedAt,createdAt:row.createdAt,updatedAt:row.updatedAt,revision:await this.revision(row.id,tx),canReconcile:settlementUnavailableReason({...row,platformFeeRate:Number(row.platformFeeRate)})===null}));
 }
 async list(q:AdminSettlementQuery,tx:Prisma.TransactionClient) {
  const rows=await tx.consultationPayoutLedger.findMany({where:{...this.where(q),...(q.cursor?{id:{gt:q.cursor}}:{})},select,orderBy:{id:'asc'},take:q.limit+1});
  const items=await Promise.all(rows.slice(0,q.limit).map(row=>this.project(row,tx)));
  return {items,nextCursor:rows.length>q.limit?items.at(-1)!.id:null};
 }
 async summary(q:Partial<AdminSettlementQuery>) {
  const rows=await this.prisma.consultationPayoutLedger.groupBy({by:['currency','status'],where:this.where(q),_count:{_all:true},_sum:{totalFeeCents:true,platformFeeCents:true,vetPayoutCents:true}});
  const grouped=new Map<string,{currency:string;count:number;totalGrossCents:number;platformFeeCents:number;vetEarningsCents:number;pendingPayoutCents:number;paidPayoutCents:number;heldPayoutCents:number;reversedPayoutCents:number}>();
  for(const row of rows) {
   const item=grouped.get(row.currency)??{currency:row.currency,count:0,totalGrossCents:0,platformFeeCents:0,vetEarningsCents:0,pendingPayoutCents:0,paidPayoutCents:0,heldPayoutCents:0,reversedPayoutCents:0};
   item.count+=row._count._all; item.totalGrossCents+=row._sum.totalFeeCents??0;item.platformFeeCents+=row._sum.platformFeeCents??0;item.vetEarningsCents+=row._sum.vetPayoutCents??0;
   const key=row.status==='PAID'?'paidPayoutCents':row.status==='HELD'?'heldPayoutCents':row.status==='REVERSED'?'reversedPayoutCents':'pendingPayoutCents';
   item[key]+=row._sum.vetPayoutCents??0;grouped.set(row.currency,item);
  }
  return adminSettlementSummarySchema.parse({items:[...grouped.values()].sort((a,b)=>a.currency.localeCompare(b.currency))});
 }
 async detail(id:string,tx:Prisma.TransactionClient) {
  const row=await tx.consultationPayoutLedger.findUnique({where:{id},select});if(!row)return null;
  const history=await tx.auditLog.findMany({where:{entityId:id,entityType:'ConsultationPayoutLedger',action:{in:actions}},select:{id:true,action:true,createdAt:true,user:identitySelect,newValues:true},orderBy:[{createdAt:'desc'},{id:'desc'}],take:51});
  return adminSettlementDetailSchema.parse(json({...await this.project(row,tx),payoutReference:row.payoutReference,payoutBatchId:row.payoutBatchId,unavailableReason:settlementUnavailableReason({...row,platformFeeRate:Number(row.platformFeeRate)}),consultation:{id:row.consultation.id,status:row.consultation.status,paymentStatus:row.consultation.paymentStatus,type:row.consultation.type,farmer:identity(row.consultation.farmer),farm:identity(row.consultation.farm),feeCents:row.consultation.feeCents,currency:row.consultation.currency},history:history.slice(0,50).map(h=>({id:h.id,action:h.action,actor:identity(h.user),createdAt:h.createdAt,reason:h.action.startsWith('ADMIN_SETTLEMENT_') && h.newValues && typeof h.newValues==='object'&&!Array.isArray(h.newValues)&&typeof h.newValues.reason==='string'?h.newValues.reason.slice(0,1000):null})),historyTruncated:history.length>50}));
 }
 async lock(ids:string[],tx:Prisma.TransactionClient) {
  // Consultations always precede ledger locks, in stable order, shared with legacy writers.
  const rows=await tx.consultationPayoutLedger.findMany({where:{id:{in:ids}},select:{consultationId:true}});
  const consultationIds=[...new Set(rows.map(r=>r.consultationId))].sort();
  if(consultationIds.length) await tx.$queryRaw(Prisma.sql`SELECT id FROM consultations WHERE id IN (${Prisma.join(consultationIds.map(id=>Prisma.sql`${id}::uuid`))}) ORDER BY id FOR UPDATE`);
  await tx.$queryRaw(Prisma.sql`SELECT id FROM consultation_payout_ledgers WHERE id IN (${Prisma.join([...ids].sort().map(id=>Prisma.sql`${id}::uuid`))}) ORDER BY id FOR UPDATE`);
 }
 reconcile(id:string,input:{payoutReference:string;payoutBatchId?:string},tx:Prisma.TransactionClient) {
  return tx.consultationPayoutLedger.update({where:{id},data:{status:'PAID',payoutReference:input.payoutReference,...(input.payoutBatchId?{payoutBatchId:input.payoutBatchId}:{}),processedAt:new Date()}});
 }
}
