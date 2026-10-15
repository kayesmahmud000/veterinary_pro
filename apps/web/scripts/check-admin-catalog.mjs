import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
const require = createRequire(import.meta.url),
  { NextRequest } = require("next/server");
function compile(file, overrides = {}) {
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  });
  const module = { exports: {} };
  new Function("require", "module", "exports", outputText)(
    (name) => overrides[name] ?? require(name),
    module,
    module.exports,
  );
  return module.exports;
}
const farmContracts = compile("../src/lib/workspace/farm-contracts.ts");
const contracts = compile("../src/lib/workspace/contracts.ts"),
  { handleWorkspace, resolveEndpoint } = compile(
    "../src/lib/workspace/server.ts",
    {
      "./contracts": contracts,
      "./farm-contracts": farmContracts,
      "../api-diagnostics": compile("../src/lib/api-diagnostics.ts"),
    },
  );

const id = "550e8400-e29b-41d4-a716-446655440001";
const product = {
  contentProvider: "INTERNAL",
  id,
  version: 2,
  title: "Synthetic guide",
  slug: "synthetic-guide",
  type: "EBOOK",
  description: "Synthetic guide description.",
  priceCents: 1000,
  discountPriceCents: null,
  currency: "USD",
  minSubscriptionTier: "STARTER",
  contentS3Key: "private/guide.pdf",
  isPublished: false,
  createdAt: "2026-10-15T00:00:00Z",
  updatedAt: "2026-10-15T00:00:00Z",
};
const identity = {
  id,
  name: "Synthetic admin",
  email: "admin@example.test",
  role: "ADMIN",
  status: "ACTIVE",
  roleVersion: 0,
  isEmailVerified: true,
  maskedPhone: null,
  avatarUrl: null,
  createdAt: product.createdAt,
};
function setup(t, role = "ADMIN", data = product) {
  const original = globalThis.fetch,
    calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: new URL(url), init });
    return Response.json({
      success: true,
      data: new URL(url).pathname.endsWith("auth/me")
        ? { ...identity, role }
        : data,
    });
  };
  t.after(() => (globalThis.fetch = original));
  return calls;
}
function request(path, method = "GET", body) {
  return new NextRequest(`http://localhost:3100/api/workspace/${path}`, {
    method,
    headers: {
      Cookie: "vetralink_access=synthetic",
      Origin: "http://localhost:3100",
      "Content-Type": "application/json",
      "x-farm-id": id,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
for (const role of ["ADMIN", "SUPER_ADMIN"])
  test(`${role} can list only the requested YouTube video courses`, async (t) => {
    const course = { ...product, type: "VIDEO_COURSE", contentProvider: "YOUTUBE", priceCents: 0, contentS3Key: "" };
    const calls = setup(t, role, { items: [course], nextCursor: null });
    const response = await handleWorkspace(request("admin/products?type=VIDEO_COURSE&contentProvider=YOUTUBE&publication=DRAFT&search=care&limit=20"), ["admin", "products"]);
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).data.items, [course]);
    assert.equal(calls[1].url.searchParams.get("type"), "VIDEO_COURSE");
    assert.equal(calls[1].url.searchParams.get("contentProvider"), "YOUTUBE");
    assert.equal(calls[1].url.searchParams.get("publication"), "DRAFT");
    assert.equal(calls[1].url.searchParams.get("search"), "care");
    assert.equal(calls[1].init.headers["x-farm-id"], undefined);
  });
for (const role of ["ADMIN", "SUPER_ADMIN"])
  test(`${role} gets guarded draft details with only approved fields`, async (t) => {
    const calls = setup(t, role, {
      ...product,
      metadata: { secret: "private" },
      password: "secret",
    });
    const res = await handleWorkspace(request(`admin/products/${id}`), [
      "admin",
      "products",
      id,
    ]);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { data: product });
    assert.equal(calls[1].init.headers["x-farm-id"], undefined);
    assert.equal(calls[1].url.pathname, `/api/v1/admin/products/${id}`);
  });
for (const role of ["VET", "BUYER", "FARMER", "LEARNER"])
  test(`${role} is denied catalog and media administration`, async (t) => {
    const calls = setup(t, role);
    for (const path of [
      ["admin", "products"],
      ["admin", "media"],
      ["admin", "media", "uploads", id],
    ])
      assert.equal(
        (await handleWorkspace(request(path.join("/")), path)).status,
        403,
      );
    assert.equal(
      calls.every((c) => c.url.pathname.endsWith("auth/me")),
      true,
    );
  });
test("catalog write cannot assign arbitrary keys, publication or metadata", async (t) => {
  setup(t);
  for (const extra of [
    { contentS3Key: "forged/key" },
    { isPublished: true },
    { metadata: { private: true } },
  ]) {
    const body = {
      title: product.title,
      slug: product.slug,
      type: product.type,
      description: product.description,
      priceCents: 1000,
      discountPriceCents: null,
      currency: "USD",
      minSubscriptionTier: "STARTER",
      ...extra,
    };
    assert.equal(
      (
        await handleWorkspace(request("admin/products", "POST", body), [
          "admin",
          "products",
        ])
      ).status,
      422,
    );
  }
  assert.equal(resolveEndpoint(["admin", "products", id], "DELETE"), null);
});
test("returned product IDs and queries fail closed", async (t) => {
  setup(t, "ADMIN", { ...product, id: "550e8400-e29b-41d4-a716-446655440002" });
  assert.equal(
    (
      await handleWorkspace(request(`admin/products/${id}`), [
        "admin",
        "products",
        id,
      ])
    ).status,
    502,
  );
  assert.equal(
    (
      await handleWorkspace(request("admin/media?limit=101"), [
        "admin",
        "media",
      ])
    ).status,
    422,
  );
});
test("multipart completion accepts a bounded manifest above the ordinary form limit", async (t) => {
  const upload = {
    id,
    productId: id,
    ownerId: id,
    filename: "large.mp4",
    contentType: "video/mp4",
    fileSizeBytes: 10737418240,
    partSizeBytes: 10485760,
    state: "UPLOADED",
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
    processingState: "idle",
    progress: 0,
    product: {
      id,
      title: "Video",
      type: "VIDEO_COURSE",
      version: 2,
      isPublished: false,
    },
  };
  setup(t, "ADMIN", upload);
  const parts = Array.from({ length: 1024 }, (_, i) => ({
    partNumber: i + 1,
    etag: "a".repeat(34),
  }));
  const res = await handleWorkspace(
    request(`admin/media/uploads/${id}/complete`, "POST", { parts }),
    ["admin", "media", "uploads", id, "complete"],
  );
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { data: upload });
});

test('admin curriculum has fixed GET/PUT mappings and source-safe projections', async (t) => {
  const path = ['admin','products',id,'curriculum'];
  assert.ok(resolveEndpoint(path,'PUT'));
  assert.equal(resolveEndpoint(path,'POST'),null);
  const source = {productId:id,version:1,isPublished:false,lessons:[{id,title:'Demo lesson',summary:'',access:'PUBLIC_DEMO',position:1,youtubeVideoId:'M7lc1UVf-VE',privateKey:'MUST_NOT_RENDER'}]};
  const calls=setup(t,'ADMIN',source);
  const response=await handleWorkspace(request(path.join('/'),'PUT',{expectedVersion:0,lessons:[{title:'Demo lesson',summary:'',access:'PUBLIC_DEMO',videoUrl:'https://youtu.be/M7lc1UVf-VE'}]}),path);
  assert.equal(response.status,200);
  const data=await response.json();
  assert.equal(data.data.productId,id);
  assert.equal(data.data.lessons[0].privateKey,undefined);
  assert.equal(calls[1].init.method,'PUT');
  assert.equal(calls[1].init.headers['x-farm-id'],undefined);
});
test('curriculum rejects a response for another course',async t=>{
  setup(t,'SUPER_ADMIN',{productId:'550e8400-e29b-41d4-a716-446655440002',version:0,isPublished:false,lessons:[]});
  const path=['admin','products',id,'curriculum'];
  assert.equal((await handleWorkspace(request(path.join('/')),path)).status,502);
});
for(const role of ['LEARNER','VET','FARMER','BUYER']) test(`${role} cannot read or write curriculum`,async t=>{
 setup(t,role,{productId:id,version:0,isPublished:false,lessons:[]});
 const path=['admin','products',id,'curriculum'];
 assert.equal((await handleWorkspace(request(path.join('/')),path)).status,403);
});

const billingDate="2026-10-16T00:00:00Z",revision="a".repeat(64);
const billingRows={
 orders:{kind:"orders",id,owner:{id,name:"Synthetic owner"},status:"COMPLETED",totalCents:1200,currency:"USD",paymentGateway:"STRIPE",providerReferencePresent:true,itemCount:1,createdAt:billingDate,updatedAt:billingDate},
 subscriptions:{kind:"subscriptions",id,owner:{id,name:"Synthetic owner"},farm:null,plan:{id,name:"Synthetic plan",tier:"PRO"},status:"ACTIVE",currentPeriodStart:billingDate,currentPeriodEnd:"2026-12-16T00:00:00Z",cancelAtPeriodEnd:false,providerManaged:false,createdAt:billingDate,updatedAt:billingDate},
 plans:{kind:"plans",id,name:"Synthetic plan",tier:"PRO",currency:"USD",priceMonthlyCents:1200,priceAnnualCents:12000,maxAnimals:30,isActive:true,createdAt:billingDate},
 dunning:{kind:"dunning",id,subscriptionId:id,owner:null,stage:"DAY_1",status:"FAILED",channel:"EMAIL",attemptCount:1,dispatchedDate:"2026-10-16",dispatchedAt:billingDate},
};
for(const role of ["ADMIN","SUPER_ADMIN"])for(const kind of Object.keys(billingRows))test(`${role} reads only safe ${kind} billing projections`,async t=>{
 const calls=setup(t,role,{items:[{...billingRows[kind],password:"MUST_NOT_RENDER",recipientEmail:"private@example.test"}],nextCursor:null});
 const path=["admin","billing",kind],response=await handleWorkspace(request(path.join("/")),path);
 assert.equal(response.status,200);const payload=await response.json();assert.equal(payload.data.items[0].kind,kind);assert.equal(JSON.stringify(payload).includes("MUST_NOT_RENDER"),false);assert.equal(JSON.stringify(payload).includes("private@example.test"),false);assert.equal(calls[1].init.headers["x-farm-id"],undefined);
});
for(const role of ["LEARNER","FARMER","VET","BUYER"])test(`${role} cannot use any billing directory or action`,async t=>{
 const calls=setup(t,role,{items:[],nextCursor:null});for(const kind of Object.keys(billingRows)){const path=["admin","billing",kind];assert.equal((await handleWorkspace(request(path.join("/")),path)).status,403);}assert.equal(calls.some(call=>call.url.pathname.includes("/admin/billing")),false);
});
test("billing disallows unimplemented financial writes and cross-kind status filters",async t=>{
 setup(t,"ADMIN");for(const path of [["admin","billing","orders",id,"refund"],["admin","billing","dunning","scan"],["admin","billing","plans","seed"]])assert.equal(resolveEndpoint(path,"POST"),null);
 for(const query of ["status=ACTIVE","limit=101","status=PENDING&status=COMPLETED"]){const path=["admin","billing","orders"];assert.equal((await handleWorkspace(request(`${path.join("/")}?${query}`),path)).status,422);}
});
test("billing plan confirmation forwards only supported fields and verifies response identity",async t=>{
 const row={...billingRows.plans,revision,history:[],historyTruncated:false},calls=setup(t,"SUPER_ADMIN",row),path=["admin","billing","plans",id];
 const body={expectedRevision:revision,name:"Updated synthetic plan",priceMonthlyCents:1500,priceAnnualCents:15000,maxAnimals:40,isActive:true,reason:"Reviewed catalogue change",actorPassword:"synthetic password"};
 assert.equal((await handleWorkspace(request(path.join("/"),"PATCH",body),path)).status,200);assert.equal(calls[1].init.method,"PATCH");
 assert.equal((await handleWorkspace(request(path.join("/"),"PATCH",{...body,refund:true}),path)).status,422);
 setup(t,"SUPER_ADMIN",{...row,id:"550e8400-e29b-41d4-a716-446655440002"});assert.equal((await handleWorkspace(request(path.join("/")),path)).status,502);
});
test("billing rejects a response for another directory kind",async t=>{setup(t,"ADMIN",{items:[billingRows.plans],nextCursor:null});const path=["admin","billing","orders"];assert.equal((await handleWorkspace(request(path.join("/")),path)).status,502);});
test("billing preserves the specific stale-record error",async t=>{
 const original=globalThis.fetch;t.after(()=>globalThis.fetch=original);globalThis.fetch=async url=>new URL(url).pathname.endsWith("auth/me")?Response.json({success:true,data:identity}):Response.json({errorDetails:{title:"BILLING_VERSION_CONFLICT"}},{status:409});
 const path=["admin","billing","subscriptions",id,"actions"],body={expectedRevision:revision,action:"SCHEDULE_CANCELLATION",reason:"Reviewed support request",actorPassword:"synthetic password"};const response=await handleWorkspace(request(path.join("/"),"POST",body),path);assert.equal(response.status,409);assert.equal((await response.json()).code,"BILLING_VERSION_CONFLICT");
});
