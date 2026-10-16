import * as shared from '@vetralink/shared-types';
describe('ADM6 review contracts', () => {
  it('exports bounded strict queries and confirmations', () => {
    const q = (shared as any).adminReviewQuerySchema;
    const m = (shared as any).adminReviewModerateSchema;
    expect(q).toBeDefined(); expect(m).toBeDefined();
    expect(q.parse({rating:'5'})).toEqual({limit:20,rating:5});
    for (const raw of [{limit:101},{rating:0},{search:'x'.repeat(101)},{isPublic:false}]) expect(q.safeParse(raw).success).toBe(false);
    const input={status:'APPROVED',expectedRevision:'a'.repeat(64),reason:' reviewed ',actorPassword:'password'};
    expect(m.parse(input).reason).toBe('reviewed');
    for(const extra of [{isPublic:true},{rating:1},{status:'PENDING'},{actorPassword:'x'.repeat(129)}]) expect(m.safeParse({...input,...extra}).success).toBe(false);
  });
});

import {AdminReviewsService} from './reviews.service';
import {AdminReviewsController} from './reviews.controller';
import {projectReview} from './reviews.repository';
import {JwtPayload,UserRole,UserStatus} from '@vetralink/shared-types';
import {UserEntity} from '../users/entities/user.entity';
import {ROLES_KEY} from '../../common/decorators/roles.decorator';
const id='550e8400-e29b-41d4-a716-446655440001',vetId='550e8400-e29b-41d4-a716-446655440002';
const claims={sub:id,role:UserRole.ADMIN,authorizationVersion:2} as JwtPayload;
const actor=(role=UserRole.ADMIN,version=2,hash='hash')=>UserEntity.reconstitute({id,role,status:UserStatus.ACTIVE,authorizationVersion:version,email:'synthetic@example.test',name:'Admin',passwordHash:hash,phone:null,phoneHash:null,avatarUrl:null,isEmailVerified:false,lastLoginAt:null,createdAt:new Date(),updatedAt:new Date(),deletedAt:null});
const input={status:'APPROVED' as const,expectedRevision:'a'.repeat(64),reason:'Reviewed synthetic review',actorPassword:'password'};
describe('ADM6 review policy',()=>{
 let service:AdminReviewsService,repo:any,users:any,passwords:any,transactions:any,audit:any,limiter:any,profiles:any;
 const tx={marker:'atomic'};
 beforeEach(()=>{
 repo={list:jest.fn(async()=>({items:[],nextCursor:null})),detail:jest.fn(async()=>({id,revision:input.expectedRevision,moderationStatus:'PENDING',allowedStatuses:['APPROVED','FLAGGED','REJECTED']})),vetId:jest.fn(async()=>vetId),lock:jest.fn(),moderate:jest.fn()};
 users={findById:jest.fn(async()=>actor()),lockById:jest.fn(async()=>actor())};passwords={compare:jest.fn(async()=>true)};transactions={run:jest.fn(async(fn:any)=>fn(tx))};audit={record:jest.fn()};limiter={hit:jest.fn()};profiles={lockReviewFence:jest.fn(),recomputeRatingAggregates:jest.fn()};
 service=new AdminReviewsService(repo,users,passwords,transactions,audit,limiter,profiles);
 });
 it('uses exact administrative guards',()=>{expect(Reflect.getMetadata(ROLES_KEY,AdminReviewsController)).toEqual([UserRole.ADMIN,UserRole.SUPER_ADMIN]);expect(Reflect.getMetadata('__guards__',AdminReviewsController).map((g:any)=>g.name)).toEqual(['JwtAuthGuard','RolesGuard']);});
 for(const role of [UserRole.LEARNER,UserRole.FARMER,UserRole.BUYER,UserRole.VET]) it(`denies ${role}`,async()=>{users.findById.mockResolvedValue(actor(role));await expect(service.list(claims,{limit:20})).rejects.toMatchObject({statusCode:403});expect(repo.list).not.toHaveBeenCalled();});
 it('rejects current and locked actor identity changes',async()=>{users.findById.mockResolvedValue(actor(UserRole.ADMIN,3));await expect(service.detail(claims,id)).rejects.toMatchObject({statusCode:403});users.findById.mockResolvedValue(actor());users.lockById.mockResolvedValue(actor(UserRole.ADMIN,2,'changed'));await expect(service.moderate(claims,id,input)).rejects.toMatchObject({statusCode:403});expect(repo.moderate).not.toHaveBeenCalled();});
 it('fails closed on password and rate limiter before mutation',async()=>{passwords.compare.mockResolvedValue(false);await expect(service.moderate(claims,id,input)).rejects.toMatchObject({errorCode:'PASSWORD_CONFIRMATION_FAILED'});expect(limiter.hit).toHaveBeenCalledWith('admin-reviews',id,10,900);passwords.compare.mockResolvedValue(true);limiter.hit.mockRejectedValue(new Error('offline'));await expect(service.moderate(claims,id,input)).rejects.toThrow('offline');expect(repo.lock).not.toHaveBeenCalled();});
 it('rejects stale, missing and same-status mutations',async()=>{await expect(service.moderate(claims,id,{...input,expectedRevision:'b'.repeat(64)})).rejects.toMatchObject({errorCode:'REVIEW_VERSION_CONFLICT'});repo.detail.mockResolvedValue({...await repo.detail(),allowedStatuses:[]});await expect(service.moderate(claims,id,input)).rejects.toMatchObject({errorCode:'REVIEW_ACTION_UNAVAILABLE'});repo.vetId.mockResolvedValue(null);await expect(service.moderate(claims,id,input)).rejects.toMatchObject({statusCode:404});expect(repo.moderate).not.toHaveBeenCalled();});
 it('atomically locks vet fence then review, moderates, aggregates and audits without secret',async()=>{await service.moderate(claims,id,input);expect(profiles.lockReviewFence).toHaveBeenCalledWith(vetId,tx);expect(repo.lock).toHaveBeenCalledWith(id,tx);expect(profiles.lockReviewFence.mock.invocationCallOrder[0]).toBeLessThan(repo.lock.mock.invocationCallOrder[0]);expect(profiles.recomputeRatingAggregates).toHaveBeenCalledWith(vetId,tx);expect(repo.moderate).toHaveBeenCalledWith(id,'APPROVED',id,input.reason,tx);expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({action:'ADMIN_REVIEW_MODERATED',newValues:expect.objectContaining({reason:input.reason})}),tx);expect(JSON.stringify(audit.record.mock.calls)).not.toContain(input.actorPassword);expect(transactions.run).toHaveBeenCalledWith(expect.any(Function),{isolationLevel:'Serializable'});});
 it('uses repeatable detail and translates conflicts',async()=>{await service.detail(claims,id);expect(transactions.run).toHaveBeenCalledWith(expect.any(Function),{isolationLevel:'RepeatableRead'});transactions.run.mockRejectedValue({code:'P2034'});await expect(service.moderate(claims,id,input)).rejects.toMatchObject({errorCode:'REVIEW_VERSION_CONFLICT',statusCode:409});});
 it('projects explicit operational fields and redacts deleted identities',()=>{const row=projectReview({id,consultationId:id,farmer:{id,name:'secret',deletedAt:new Date()},vet:{id:vetId,name:'Vet',deletedAt:null},passwordHash:'secret',email:'secret',feedback:'authored',tags:['KIND'],isPublic:false} as any);expect(row.farmer).toBeNull();expect(row.feedback).toBe('authored');expect(row.isPublic).toBe(false);expect(JSON.stringify(row)).not.toContain('secret');});
});
