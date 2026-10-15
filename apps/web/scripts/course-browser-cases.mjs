import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import path from 'node:path';
const id='cc0e8400-e29b-41d4-a716-446655440001',mainId='cc0e8400-e29b-41d4-a716-446655440002',demoId='cc0e8400-e29b-41d4-a716-446655440003';
const memberships=new Map();
const fixture={failEnrollment:false,published:true};
const course={id,slug:'synthetic-free-course',title:'Synthetic free course',description:'Synthetic video lessons for controlled browser acceptance.',provider:'YOUTUBE',access:'FREE_ENROLLMENT',lessonCount:2,demoCount:1,firstLessonId:mainId,lessons:[{id:mainId,title:'Synthetic main lesson',summary:'',access:'ENROLLED',position:1},{id:demoId,title:'Synthetic public demo',summary:'',access:'PUBLIC_DEMO',position:2}]};
const playback=lessonId=>({productId:id,lessonId,title:lessonId===mainId?'Synthetic main lesson':'Synthetic public demo',provider:'YOUTUBE',videoId:lessonId===mainId?'MainVid_001':'DemoVid_001'});
export function handleCourseFixture(route,role,send,query,method,body,res){
 if(!route.startsWith('courses')&&!route.startsWith('me/courses'))return false;
 const error=(code,status=403)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify({errorDetails:{title:code}}));};
 if(!fixture.published){send(404,null);return true;}
 if(route==='courses'){send(200,{items:!query.get('search')||course.title.toLowerCase().includes(query.get('search').toLowerCase())?[course]:[],nextCursor:null});return true;}
 if(route===`courses/slug/${course.slug}`){send(200,course);return true;}
 if(route===`courses/${id}/lessons/${demoId}/demo-playback`){send(200,playback(demoId));return true;}
 if(route===`me/courses`){send(200,{items:memberships.has(role)?[{...course,enrollment:memberships.get(role)}]:[],nextCursor:null});return true;}
 if(route===`me/courses/${id}`){send(200,{...course,enrollment:memberships.get(role)??null});return true;}
 if(route===`me/courses/${id}/enrollment`&&method==='POST'){
  if(!memberships.has(role))memberships.set(role,{id:'cc0e8400-e29b-41d4-a716-446655440004',productId:id,createdAt:'2026-10-15T00:00:00Z'});
  if(fixture.failEnrollment){fixture.failEnrollment=false;send(503,null);}else send(200,memberships.get(role));return true;
 }
 if([`me/courses/${id}/lessons/${mainId}/playback`,`me/courses/${id}/lessons/${demoId}/playback`].includes(route)){
  if(!memberships.has(role))error('COURSE_ENROLLMENT_REQUIRED');else send(200,playback(route.includes(mainId)?mainId:demoId));return true;
 }
 send(404,null);return true;
}
export async function checkLearnerCourses({seed,go,call,evaluate,until,temp,requests,origin}){
 let checks=0;
 const script=await call('Page.addScriptToEvaluateOnNewDocument',{source:`window.__players=[];window.__destroyed=0;window.YT={Player:class{constructor(frame,options){this.frame=frame;window.__players.push({src:frame.src,events:options.events});const mode=sessionStorage.getItem('synthetic-player-mode');if(mode!=='hang')setTimeout(()=>mode==='error'?options.events.onError({data:100}):options.events.onReady(),0);}destroy(){window.__destroyed++;this.frame.remove();}}};`});
 await call('Network.setBlockedURLs',{urls:['*youtube-nocookie.com/*','*youtube.com/iframe_api*']});
 const set=async(selector,value)=>evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 try{
  for(const locale of ['bn','en'])for(const width of [320,1440]){
   memberships.clear();await seed('LEARNER',locale);await call('Network.deleteCookies',{name:'vetralink_access',url:origin});await call('Network.deleteCookies',{name:'vetralink_refresh',url:origin});
   await call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});
   await go('/courses');await until(()=>evaluate(`!!document.querySelector('[data-course-card]')`),'Public course catalog');checks++;
   await go(`/courses/${course.slug}`);await until(()=>evaluate(`!!document.querySelector('[data-demo-lesson]')`),'Public course outline');
   assert.equal(await evaluate(`document.body.innerHTML.includes('MainVid_001')`),false);assert.equal(await evaluate(`!!document.querySelector('[data-youtube-player]')`),false);checks+=2;
   await evaluate(`document.querySelector('[data-demo-lesson]').click()`);await until(()=>evaluate(`!!document.querySelector('[data-youtube-player]')`),'Public inline demo');
   assert.equal(await evaluate(`document.querySelector('[data-youtube-player]').src.includes('DemoVid_001')`),true);assert.equal(await evaluate(`document.querySelector('[data-youtube-player]').getBoundingClientRect().height>=200`),true);assert.equal(await evaluate(`document.documentElement.scrollWidth>innerWidth`),false);checks+=3;
   const publicShot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile(path.join(temp,`course-public-${locale}-${width}.png`),Buffer.from(publicShot.data,'base64'));
   await seed('LEARNER',locale);await go(`/account/courses/${id}/lessons/${mainId}`);await until(()=>evaluate(`!!document.querySelector('[data-course-enroll]')`),'Explicit free enrollment');
   assert.equal(await evaluate(`!!document.querySelector('[data-youtube-player]')`),false);checks++;
   fixture.failEnrollment=true;await evaluate(`document.querySelector('[data-course-enroll]').click()`);await until(()=>evaluate(`!!document.querySelector('main [role="alert"]')`),'Lost enrollment acknowledgement');
   await evaluate(`document.querySelector('[data-course-enroll]').click()`);await until(()=>evaluate(`!!document.querySelector('[data-youtube-player]')`),'Enrolled lesson playback');
   assert.equal(memberships.size,1);assert.equal(await evaluate(`document.querySelector('[data-youtube-player]').src.includes('MainVid_001')`),true);checks+=2;
   const before=await evaluate('window.__destroyed');await evaluate(`document.querySelector('a[href="/account/courses/${id}/lessons/${demoId}"]').click()`);await until(()=>evaluate(`document.querySelector('[data-youtube-player]')?.src.includes('DemoVid_001')`),'Lesson selection');assert.ok(await evaluate('window.__destroyed')>before);checks++;
   const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile(path.join(temp,`course-watch-${locale}-${width}.png`),Buffer.from(shot.data,'base64'));
   await go('/account/courses');await until(()=>evaluate(`!!document.querySelector('[data-course-library] a[href*="/lessons/"]')`),'Own enrolled library');checks++;
   await seed('BUYER',locale);await go('/account/courses');await until(()=>evaluate(`!!document.querySelector('[data-course-library]')`),'Other account library');assert.equal(await evaluate(`!!document.querySelector('[data-course-library] a[href*="/lessons/"]')`),false);checks++;
  }
  await seed('LEARNER','en');await go(`/account/courses/${id}/lessons/${mainId}`);await until(()=>evaluate(`!!document.querySelector('[data-youtube-player]')`),'Player error setup');
  await evaluate(`sessionStorage.setItem('synthetic-player-mode','error')`);await go(`/account/courses/${id}/lessons/${mainId}`);await until(()=>evaluate(`!!document.querySelector('[data-course-player] [role="alert"]')`),'Unavailable video recovery');checks++;
  await evaluate(`sessionStorage.removeItem('synthetic-player-mode');document.querySelector('[data-course-player] button').click()`);await until(()=>evaluate(`!document.querySelector('[data-course-player] [role="alert"]')`),'Player retry');checks++;
  await evaluate(`sessionStorage.setItem('synthetic-player-mode','hang')`);await go(`/account/courses/${id}/lessons/${mainId}`);await until(()=>evaluate(`!!document.querySelector('[data-course-player] [role="alert"]')`),'Bounded iframe readiness',20000);checks++;
  await evaluate(`sessionStorage.removeItem('synthetic-player-mode')`);
  memberships.clear();const registrationsBeforeLogin=requests.filter(request=>request.route.endsWith('/enrollment')).length;
  await call('Network.deleteCookies',{name:'vetralink_access',url:origin});await call('Network.deleteCookies',{name:'vetralink_refresh',url:origin});await go(`/courses/${course.slug}`);await until(()=>evaluate(`!!document.querySelector('[data-course-enroll]:not([disabled])')`),'Sign-in enrollment entry');
  await evaluate(`document.querySelector('[data-course-enroll]').click()`);await until(()=>evaluate(`!!document.querySelector('dialog[open] input[type="email"]')`),'Course auth dialog');
  await set('dialog[open] input[type="email"]','learner@example.test');await set('dialog[open] input[type="password"]','DemoPassword123!');
  // Use the existing fixture learner email; no special authentication path.
  await evaluate(`document.querySelector('dialog[open] form').requestSubmit()`);
  await until(()=>evaluate(`location.pathname==='/account/courses/${id}/lessons/${mainId}'`),'Validated lesson return after sign-in');
  await until(()=>evaluate(`!!document.querySelector('[data-course-enroll]')`),'Explicit enrollment after sign-in');assert.equal(memberships.size,0);assert.equal(requests.filter(request=>request.route.endsWith('/enrollment')).length,registrationsBeforeLogin);checks+=3;
  await evaluate(`document.querySelector('[data-course-enroll]').click()`);await until(()=>evaluate(`!!document.querySelector('[data-youtube-player]')`),'Signed-in enrollment playback');checks++;
  assert.equal(requests.some(request=>request.route.includes('me/courses')&&request.farmId),false);checks++;
 }finally{
  await call('Page.removeScriptToEvaluateOnNewDocument',{identifier:script.identifier});await call('Network.setBlockedURLs',{urls:[]});memberships.clear();fixture.published=true;
 }
 console.log(`Passed ${checks} learner course browser checks.`);return checks;
}
