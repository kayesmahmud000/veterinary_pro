import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";
const ids={orders:"110e8400-e29b-41d4-a716-446655440001",plans:"220e8400-e29b-41d4-a716-446655440001",subscriptions:"330e8400-e29b-41d4-a716-446655440001",dunning:"440e8400-e29b-41d4-a716-446655440001",provider:"330e8400-e29b-41d4-a716-446655440002"};
const date="2026-10-16T00:00:00Z",owner={id:"550e8400-e29b-41d4-a716-446655440001",name:"Synthetic billing owner"};
export const billingState={failure:null,unavailable:false,version:0};
const plan={kind:"plans",id:ids.plans,name:"Synthetic Pro plan",tier:"PRO",currency:"USD",priceMonthlyCents:1200,priceAnnualCents:12000,maxAnimals:30,isActive:true,createdAt:date,revision:"a".repeat(64),history:[],historyTruncated:false};
const subscription={kind:"subscriptions",id:ids.subscriptions,owner,farm:null,plan:{id:ids.plans,name:plan.name,tier:"PRO"},status:"ACTIVE",currentPeriodStart:date,currentPeriodEnd:"2030-10-16T00:00:00Z",cancelAtPeriodEnd:false,providerManaged:false,createdAt:date,updatedAt:date,revision:"b".repeat(64),allowedActions:["SCHEDULE_CANCELLATION"],history:[],historyTruncated:false};
const rows={orders:{kind:"orders",id:ids.orders,owner,status:"COMPLETED",totalCents:1200,currency:"USD",paymentGateway:"STRIPE",providerReferencePresent:true,itemCount:1,createdAt:date,updatedAt:date,items:[{id:ids.plans,productId:ids.plans,title:"Synthetic guide",priceCents:1200,downloadCount:2,lastDownloadedAt:null}],itemsTruncated:false,history:[{action:"ORDER_COMPLETED",createdAt:date,reason:null}],historyTruncated:false},subscriptions:subscription,plans:plan,dunning:{kind:"dunning",id:ids.dunning,subscriptionId:ids.subscriptions,owner,stage:"DAY_1",status:"FAILED",channel:"EMAIL",attemptCount:2,dispatchedDate:"2026-10-16",dispatchedAt:date}};
export function handleBillingFixture(req,res,data,route,role){
 if(!route.startsWith("admin/billing/"))return false;
 const send=(status,value,code)=>{res.writeHead(status,{"Content-Type":"application/json"});res.end(JSON.stringify({success:status<400,data:value,...(code?{errorDetails:{title:code}}:{})}));return true;};
 if(!["ADMIN","SUPER_ADMIN"].includes(role))return send(403,null);
 if(billingState.unavailable)return send(503,null);
 const [, ,kind,id,suffix]=route.split("/");if(!rows[kind])return send(404,null);
 if(req.method==="GET"){
   if(id){if(id===ids.provider&&kind==="subscriptions")return send(200,{...subscription,id,providerManaged:true,allowedActions:[]});return send(id===rows[kind].id?200:404,id===rows[kind].id?rows[kind]:null);}
   const q=new URL(req.url,"http://fixture").searchParams;
   let items=[rows[kind]];
   if(q.get("search"))items=items.filter(row=>JSON.stringify(row).toLowerCase().includes(q.get("search").toLowerCase()));
   if(q.get("status"))items=items.filter(row=>(kind==="plans"?(row.isActive?"ACTIVE":"INACTIVE"):row.status)===q.get("status"));
   return send(200,{items,nextCursor:null});
 }
 if(billingState.failure)return send(409,null,billingState.failure);
 if(data.actorPassword!=="DemoPassword123!")return send(403,null,"PASSWORD_CONFIRMATION_FAILED");
 const row=rows[kind];if(row.revision!==data.expectedRevision)return send(409,null,"BILLING_VERSION_CONFLICT");
 if(kind==="plans"&&req.method==="PATCH"){
   for(const key of ["name","priceMonthlyCents","priceAnnualCents","maxAnimals","isActive"])row[key]=data[key];
   row.history.unshift({action:"SUBSCRIPTION_PLAN_UPDATED",createdAt:date,reason:data.reason});
 }else if(kind==="subscriptions"&&suffix==="actions"&&req.method==="POST"){
   if(!row.allowedActions.includes(data.action))return send(409,null,"BILLING_ACTION_UNAVAILABLE");
   row.cancelAtPeriodEnd=data.action==="SCHEDULE_CANCELLATION";row.allowedActions=[row.cancelAtPeriodEnd?"REVOKE_CANCELLATION":"SCHEDULE_CANCELLATION"];
   row.history.unshift({action:row.cancelAtPeriodEnd?"SUBSCRIPTION_CANCELLATION_SCHEDULED":"SUBSCRIPTION_CANCELLATION_REVOKED",createdAt:date,reason:data.reason});
 }else return send(404,null);
 row.revision=(++billingState.version).toString(16).padStart(64,"0");return send(200,row);
}
export async function checkAdminBilling({seed,go,call,evaluate,until,temp,requests}){
 let checks=0;
 const set=(id,value)=>evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)});Object.getOwnPropertyDescriptor(e instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 const confirm=async()=>{await evaluate(`document.querySelector('[data-billing-support] form').requestSubmit()`);await until(()=>evaluate(`!!document.querySelector('dialog[open]')`),"Billing confirmation");await evaluate(`document.querySelector('dialog[open] button').click()`);};
 const saveReady=async()=>until(()=>evaluate(`!document.querySelector('dialog[open]')&&!!document.querySelector('[data-billing-support]')&&!!document.querySelector('main [role="status"]')`),"Saved billing record");
 const shot=async name=>{const screenshot=await call("Page.captureScreenshot",{format:"png",captureBeyondViewport:true});await writeFile(path.join(temp,name),Buffer.from(screenshot.data,"base64"));};
 for(const role of ["ADMIN","SUPER_ADMIN"])for(const locale of ["bn","en"])for(const width of [320,1440]){
   await seed(role,locale);await call("Emulation.setDeviceMetricsOverride",{width,height:1000,deviceScaleFactor:1,mobile:width<600});
   await go("/admin/dashboard");await until(()=>evaluate(`!!document.querySelector('[data-admin-billing-shortcut] a')`),"Dashboard billing entry");await evaluate(`document.querySelector('[data-admin-billing-shortcut] a').click()`);
   await until(()=>evaluate(`!!document.querySelector('[data-billing-list="orders"] [data-billing-row]')`),"Billing directory navigation");checks++;
   for(const kind of Object.keys(rows)){
     await go(`/admin/${kind}`);await until(()=>evaluate(`!!document.querySelector('[data-billing-list="${kind}"] [data-billing-row]')`),"Billing rows");
     assert.equal(await evaluate("document.documentElement.scrollWidth>innerWidth"),false);checks++;
     await evaluate(`document.querySelector('[data-billing-row] a').click()`);await until(()=>evaluate(`!!document.querySelector('[data-billing-detail="${kind}"]')`),"Billing details");
     assert.equal(await evaluate(`!!document.querySelector('main [role="alert"]')`),false);assert.equal(await evaluate("document.documentElement.scrollWidth>innerWidth"),false);checks+=2;
     if(role==="ADMIN")await shot(`billing-${kind}-${locale}-${width}.png`);
     if(kind==="plans"){
       await set("billing-name",`Synthetic plan ${locale} ${width}`);await set("billing-reason","Reviewed synthetic catalogue update");await set("billing-password","DemoPassword123!");
       if(role==="ADMIN"&&locale==="en"&&width===320){
         billingState.failure="BILLING_VERSION_CONFLICT";await confirm();await until(()=>evaluate(`!!document.querySelector('[data-billing-support] [role="alert"]')`),"Billing conflict feedback");
         assert.equal(await evaluate(`document.getElementById('billing-name').value`),`Synthetic plan ${locale} ${width}`);assert.equal(await evaluate(`document.getElementById('billing-reason').value`),"Reviewed synthetic catalogue update");assert.equal(await evaluate(`document.getElementById('billing-password').value`),"");checks+=3;
         billingState.failure=null;await set("billing-password","DemoPassword123!");
       }
       await confirm();await saveReady();assert.equal(plan.name,`Synthetic plan ${locale} ${width}`);assert.equal(await evaluate(`document.getElementById('billing-password').value`),"");checks+=2;
     }
     if(kind==="subscriptions"){
       const before=subscription.cancelAtPeriodEnd;await set("billing-reason","Reviewed synthetic cancellation request");await set("billing-password","DemoPassword123!");await confirm();await saveReady();assert.equal(subscription.cancelAtPeriodEnd,!before);checks++;
       await go(`/admin/subscriptions/${ids.provider}`);await until(()=>evaluate(`!!document.querySelector('[data-billing-detail="subscriptions"]')`),"Provider-managed subscription read");assert.equal(await evaluate(`!!document.querySelector('[data-billing-support]')`),false);checks++;
     }
   }
 }
 await seed("ADMIN","en");await go("/admin/orders");await until(()=>evaluate(`!!document.querySelector('[data-billing-row]')`),"Order list ready");await set("billing-search","no-such-fixture");await evaluate(`document.getElementById('billing-search').closest('form').requestSubmit()`);await until(()=>evaluate(`document.querySelector('[data-billing-list]').textContent.includes('No matching records.')`),"Empty billing search");checks++;
 billingState.unavailable=true;await go("/admin/orders");await until(()=>evaluate(`!!document.querySelector('main [role="alert"]')`),"Billing unavailable feedback");billingState.unavailable=false;await evaluate(`document.querySelector('main [role="alert"]').parentElement.querySelector('button').click()`);await until(()=>evaluate(`!!document.querySelector('[data-billing-row]')`),"Billing retry recovery");checks++;
 for(const role of ["LEARNER","FARMER","VET","BUYER"]){await seed(role,"en");for(const kind of Object.keys(rows)){await go(`/admin/${kind}`,"/account/profile");assert.equal(await evaluate(`!!document.querySelector('[data-billing-list],[data-billing-detail]')`),false);checks++;}assert.equal(await evaluate(`fetch('/api/workspace/admin/billing/orders').then(r=>r.status)`),403);checks++;}
 assert(requests.some(r=>r.route==="admin/billing/plans/"+ids.plans&&r.method==="PATCH"));
 assert.equal(requests.some(r=>/admin\/billing\/.*(?:refund|seed|scan|dispatch)/.test(r.route)),false);checks+=2;
 console.log(`Passed ${checks} billing browser checks. Screenshots: ${temp}`);return checks;
}
