import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { createHash } from "crypto";
import { AdminReviewQuery, adminReviewActions, adminReviewDetailSchema, adminReviewHistoryActions, adminReviewListSchema } from "@vetralink/shared-types";
import { PrismaService } from "../prisma/prisma.service";
const identitySelect={id:true,name:true,deletedAt:true} as const;
const reviewSelect={id:true,consultationId:true,farmer:{select:identitySelect},vet:{select:identitySelect},rating:true,feedback:true,tags:true,isPublic:true,moderationStatus:true,moderatedAt:true,createdAt:true,updatedAt:true} as const;
type Review=Prisma.ConsultationReviewGetPayload<{select:typeof reviewSelect}>;
const identity=(value:{id:string;name:string;deletedAt:Date|null}|null)=>value && !value.deletedAt ? {id:value.id,name:value.name}:null;
const json=(value:unknown)=>JSON.parse(JSON.stringify(value));
export function projectReview(r:Review) {
 return {id:r.id,consultationId:r.consultationId,farmer:identity(r.farmer),vet:identity(r.vet),rating:r.rating,feedback:r.feedback,tags:Array.isArray(r.tags)?r.tags.filter((t):t is string=>typeof t==='string'):[],isPublic:r.isPublic,moderationStatus:r.moderationStatus,moderatedAt:r.moderatedAt,createdAt:r.createdAt,updatedAt:r.updatedAt};
}
@Injectable()
export class AdminReviewsRepository {
 constructor(private readonly prisma:PrismaService){}
 async list(q:AdminReviewQuery) {
  const term=q.search?{contains:q.search,mode:'insensitive' as const}:undefined;
  const idSearch=q.search && /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(q.search)?[{id:q.search},{consultationId:q.search}]:[];
  const where:Prisma.ConsultationReviewWhereInput={...(q.cursor?{id:{gt:q.cursor}}:{}),...(q.status?{moderationStatus:q.status}:{}),...(q.vetId?{vetId:q.vetId}:{}),...(q.rating?{rating:q.rating}:{}),...(term?{OR:[...idSearch,{feedback:term},{farmer:{deletedAt:null,name:term}},{vet:{deletedAt:null,name:term}}]}:{})};
  const rows=await this.prisma.consultationReview.findMany({where,select:reviewSelect,orderBy:{id:'asc'},take:q.limit+1});
  return adminReviewListSchema.parse(json({items:rows.slice(0,q.limit).map(projectReview),nextCursor:rows.length>q.limit?rows[q.limit-1].id:null}));
 }
 async vetId(id:string,tx:Prisma.TransactionClient) { return (await tx.consultationReview.findUnique({where:{id},select:{vetId:true}}))?.vetId ?? null; }
 async lock(id:string,tx:Prisma.TransactionClient) {await tx.$queryRaw`SELECT id FROM consultation_reviews WHERE id=${id}::uuid FOR UPDATE`;}
 async revision(id:string,tx:Prisma.TransactionClient) {
  const rows=await tx.$queryRaw<Array<{revision:string}>>`SELECT xmin::text AS revision FROM consultation_reviews WHERE id=${id}::uuid`;
  return rows[0]?createHash('sha256').update(`review:${id}:${rows[0].revision}`).digest('hex'):null;
 }
 async detail(id:string,tx:Prisma.TransactionClient) {
  const row=await tx.consultationReview.findUnique({where:{id},select:{...reviewSelect,moderationReason:true,moderatedBy:{select:identitySelect},consultation:{select:{id:true,status:true,type:true,farm:{select:identitySelect}}}}});
  if(!row)return null;
  const history=await tx.auditLog.findMany({where:{entityType:'ConsultationReview',entityId:id,action:{in:[...adminReviewHistoryActions]}},select:{id:true,action:true,user:{select:identitySelect},newValues:true,createdAt:true},orderBy:[{createdAt:'desc'},{id:'desc'}],take:51});
  return adminReviewDetailSchema.parse(json({...projectReview(row),revision:await this.revision(id,tx),moderationReason:row.moderationReason,moderator:identity(row.moderatedBy),allowedStatuses:adminReviewActions.filter(s=>s!==row.moderationStatus),consultation:{id:row.consultation.id,status:row.consultation.status,type:row.consultation.type,farm:identity(row.consultation.farm)},history:history.slice(0,50).map(h=>{
   const v=h.newValues;const reason=v && typeof v==='object' && !Array.isArray(v) ? (typeof v.reason==='string'?v.reason:typeof v.moderationReason==='string'?v.moderationReason:null):null;
   return {id:h.id,action:h.action,actor:identity(h.user),reason:reason?.slice(0,1000)??null,createdAt:h.createdAt};
  }),historyTruncated:history.length>50}));
 }
 async moderate(id:string,status:'APPROVED'|'FLAGGED'|'REJECTED',actorId:string,reason:string,tx:Prisma.TransactionClient) {
  await tx.consultationReview.update({where:{id},data:{moderationStatus:status,moderationReason:reason,moderatedById:actorId,moderatedAt:new Date()}});
 }
}
