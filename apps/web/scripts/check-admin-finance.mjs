import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
const require = createRequire(import.meta.url),
  { NextRequest } = require("next/server");
function compile(file, overrides = {}) {
  const { outputText } = ts.transpileModule(
    readFileSync(new URL(file, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    },
  );
  const module = { exports: {} };
  new Function("require", "module", "exports", outputText)(
    (name) => overrides[name] ?? require(name),
    module,
    module.exports,
  );
  return module.exports;
}
const { resolveEndpoint, handleWorkspace } = compile(
  "../src/lib/workspace/server.ts",
  {
    "./contracts": compile("../src/lib/workspace/contracts.ts"),
    "./farm-contracts": compile("../src/lib/workspace/farm-contracts.ts"),
    "../api-diagnostics": compile("../src/lib/api-diagnostics.ts"),
  },
);

const id="550e8400-e29b-41d4-a716-446655440001", other="550e8400-e29b-41d4-a716-446655440002", date="2026-10-16T00:00:00Z";
const identity={id,name:"Operator",email:"operator@example.test",role:"ADMIN",status:"ACTIVE",roleVersion:0,createdAt:date,isEmailVerified:false,avatarUrl:null,maskedPhone:null};
function request(path,method="GET",body,headers={}){return new NextRequest(`http://localhost:3100/api/workspace/${path}`,{method,headers:{Cookie:"vetralink_access=synthetic",Origin:"http://localhost:3100","Content-Type":"application/json",...headers},...(body?{body:JSON.stringify(body)}:{})});}
function fixture(t,{role="ADMIN",data={items:[],nextCursor:null},status=200,code}={}){const original=globalThis.fetch,calls=[];globalThis.fetch=async(url,init)=>{calls.push({url:new URL(url),init});return new URL(url).pathname.endsWith('/auth/me')?Response.json({success:true,data:{...identity,role}}):Response.json(code?{errorDetails:{title:code},secret:"private"}:{success:true,data},{status});};t.after(()=>{globalThis.fetch=original;});return calls;}
const single={expectedRevision:"a".repeat(64),reason:"Reviewed externally",actorPassword:"synthetic",payoutReference:"BANK-123"};
const moderate={expectedRevision:single.expectedRevision,reason:single.reason,actorPassword:single.actorPassword,status:"APPROVED"};
test("finance routes admit exact methods and UUIDs only",()=>{for(const [path,method] of [["admin/settlements","GET"],["admin/settlements/summary","GET"],[`admin/settlements/${id}`,"GET"],[`admin/settlements/${id}/preview`,"GET"],[`admin/settlements/${id}/reconcile`,"POST"],["admin/settlements/bulk-reconcile","POST"],["admin/reviews","GET"],[`admin/reviews/${id}`,"GET"],[`admin/reviews/${id}/moderate`,"POST"]])assert.ok(resolveEndpoint(path.split('/'),method),`${method} ${path}`);for(const [path,method]of [["admin/settlements","POST"],["admin/settlements/bad","GET"],[`admin/reviews/${id}/moderate`,"GET"],[`admin/settlements/${id}/reconcile`,"PATCH"]])assert.equal(resolveEndpoint(path.split('/'),method),null);});
for(const role of ["ADMIN","SUPER_ADMIN","LEARNER","FARMER","BUYER","VET"])test(`${role} finance list exact role gate`,async(t)=>{const calls=fixture(t,{role});for(const kind of ["settlements","reviews"]){const res=await handleWorkspace(request(`admin/${kind}`),["admin",kind]);assert.equal(res.status,["ADMIN","SUPER_ADMIN"].includes(role)?200:403);}assert.equal(calls.length,["ADMIN","SUPER_ADMIN"].includes(role)?4:2);});
test("finance queries and action bodies reject invalid input before upstream",async(t)=>{const calls=fixture(t);for(const [kind,queries] of [["settlements",["currency=bdt","vetId=bad","status=bad","limit=101","limit=20&limit=21","email=secret"]],["reviews",["rating=6","rating=1.5","vetId=bad","status=bad","limit=0"]]])for(const q of queries)assert.equal((await handleWorkspace(request(`admin/${kind}?${q}`),["admin",kind])).status,422);for(const [kind,suffix,input] of [["settlements","reconcile",single],["reviews","moderate",moderate]]){for(const body of [{...input,extra:true},{...input,reason:"tiny"},{...input,expectedRevision:"bad"},{...input,actorPassword:""}])assert.equal((await handleWorkspace(request(`admin/${kind}/${id}/${suffix}`,"POST",body),["admin",kind,id,suffix])).status,422);assert.equal((await handleWorkspace(request(`admin/${kind}/${id}/${suffix}`,"POST",input,{"content-length":"17000"}),["admin",kind,id,suffix])).status,413);}assert.equal(calls.length,0);});
const navigation=compile("../src/lib/workspace/navigation.ts",{"../i18n/workspace-shell":compile("../src/lib/i18n/workspace-shell.ts")});
test("finance return paths retain bounded filters and deny vet mismatch",()=>{for(const path of [`/admin/settlements`,`/admin/settlements/${id}`,`/admin/settlements/vets/${id}?vetId=${id}&status=PENDING&currency=BDT`,`/admin/reviews?rating=5&status=FLAGGED`,`/admin/reviews/${id}`])assert.equal(navigation.validateWorkspaceReturnTo(path),path);for(const path of [`/admin/settlements/vets/${id}?vetId=${other}`,`/admin/settlements?currency=bdt`,`/admin/reviews?rating=6`,`/admin/reviews/${id}?status=PENDING`])assert.equal(navigation.validateWorkspaceReturnTo(path),null);});
