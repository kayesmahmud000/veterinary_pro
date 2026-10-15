import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url),{NextRequest}=require('next/server');
function compile(file,overrides={}){const {outputText}=ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}});const module={exports:{}};new Function('require','module','exports',outputText)(name=>overrides[name]??require(name),module,module.exports);return module.exports;}
const diagnostics=compile('../src/lib/api-diagnostics.ts');
const {handleCourses,resolvePublicCourse}=compile('../src/lib/courses/server.ts',{'../api-diagnostics':diagnostics});
const {handleWorkspace,resolveEndpoint}=compile('../src/lib/workspace/server.ts',{'./contracts':compile('../src/lib/workspace/contracts.ts'),'./farm-contracts':compile('../src/lib/workspace/farm-contracts.ts'),'../api-diagnostics':diagnostics});
const id='550e8400-e29b-41d4-a716-446655440001',lessonId='550e8400-e29b-41d4-a716-446655440002';
const course={id,title:'Synthetic course',slug:'synthetic-course',description:'Synthetic description',provider:'YOUTUBE',access:'FREE_ENROLLMENT',lessonCount:1,demoCount:0,firstLessonId:lessonId,lessons:[{id:lessonId,title:'Main lesson',summary:'',access:'ENROLLED',position:1,youtubeVideoId:'PRIVATE_ID1'}]};
const identity={id,name:'Learner',email:'learner@example.test',role:'LEARNER',status:'ACTIVE',roleVersion:0,isEmailVerified:true,maskedPhone:null,avatarUrl:null,createdAt:'2026-10-15T00:00:00Z'};
test('public outline strips source fields and never forwards credentials or farm headers',async t=>{
 const original=globalThis.fetch,calls=[];t.after(()=>globalThis.fetch=original);globalThis.fetch=async(url,init)=>{calls.push({url:String(url),init});return Response.json({success:true,data:course});};
 const res=await handleCourses(new NextRequest('http://localhost/api/courses/slug/synthetic-course',{headers:{Cookie:'secret',Authorization:'Bearer secret','x-farm-id':id}}),['slug','synthetic-course']);
 assert.equal(res.status,200);assert.equal(JSON.stringify(await res.json()).includes('PRIVATE_ID1'),false);assert.deepEqual(calls[0].init.headers,{Accept:'application/json'});
});
test('public mapping rejects private/unknown paths and malformed parameters',()=>{
 assert.equal(resolvePublicCourse(['me','courses']),null);assert.equal(resolvePublicCourse([id,'lessons',lessonId,'playback']),null);assert.equal(resolvePublicCourse(['slug','invalid/slash']),null);assert.ok(resolvePublicCourse([]));
});
for(const role of ['LEARNER','BUYER','VET','FARMER','ADMIN','SUPER_ADMIN'])test(`${role} uses fixed own enrollment route with current identity`,async t=>{
 const original=globalThis.fetch,calls=[];t.after(()=>globalThis.fetch=original);globalThis.fetch=async(url,init)=>{calls.push({url:String(url),init});return Response.json({success:true,data:String(url).endsWith('auth/me')?{...identity,role}:{id,productId:id,createdAt:identity.createdAt}});};
 const path=['me','courses',id,'enrollment'];const res=await handleWorkspace(new NextRequest(`http://localhost/api/workspace/${path.join('/')}`,{method:'POST',headers:{Origin:'http://localhost',Cookie:'vetralink_access=synthetic','Content-Type':'application/json','x-farm-id':id},body:'{}'}),path);
 assert.equal(res.status,200);assert.equal(calls.length,2);assert.equal(calls[1].init.headers['x-farm-id'],undefined);assert.equal(res.headers.get('Cache-Control'),'private, no-store');
});
test('playback mapping binds both product and lesson IDs and forbids caller user IDs',()=>{
 const endpoint=resolveEndpoint(['me','courses',id,'lessons',lessonId,'playback'],'GET');assert.equal(endpoint.productId,id);assert.equal(endpoint.lessonId,lessonId);
 assert.equal(resolveEndpoint(['me','courses',id,'enrollment'],'POST').body.safeParse({userId:id}).success,false);
});
const {youtubeEmbedUrl}=compile('../src/lib/courses/youtube-player.ts');
test('player constructs only official privacy-enhanced iframe URLs with origin and no autoplay',()=>{
 const url=new URL(youtubeEmbedUrl('M7lc1UVf-VE','https://school.example.test','bn'));
 assert.equal(url.origin,'https://www.youtube-nocookie.com');assert.equal(url.pathname,'/embed/M7lc1UVf-VE');assert.equal(url.searchParams.get('origin'),'https://school.example.test');assert.equal(url.searchParams.get('autoplay'),'0');assert.equal(url.searchParams.get('enablejsapi'),'1');
 assert.throws(()=>youtubeEmbedUrl('bad/video','https://school.example.test','en'));assert.throws(()=>youtubeEmbedUrl('M7lc1UVf-VE','javascript:alert(1)','en'));
});
