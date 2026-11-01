import { checkAdminYouTube } from "./admin-youtube-browser-cases.mjs";
import { checkAdminCourseManagement } from "./admin-course-management-browser-cases.mjs";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";
const productId = "bb0e8400-e29b-41d4-a716-446655440001",
  products = new Map(),
  curricula = new Map(),
  uploads = new Map();
const state = { conflict: false, transferFailure: false, processing: "idle", createFailure: false };
const base = () => ({
  contentProvider: "INTERNAL",
  id: productId,
  version: 0,
  title: "Synthetic catalog guide",
  slug: "synthetic-catalog-guide",
  type: "EBOOK",
  description: "Synthetic catalog product description.",
  priceCents: 1000,
  discountPriceCents: null,
  currency: "BDT",
  minSubscriptionTier: "STARTER",
  contentS3Key: "",
  isPublished: false,
  createdAt: "2026-10-15T00:00:00Z",
  updatedAt: "2026-10-15T00:00:00Z",
});
products.set(productId, base());
function uploadView(row) {
  return {
    ...row,
    product: {
      id: row.productId,
      title: products.get(row.productId).title,
      type: products.get(row.productId).type,
      version: products.get(row.productId).version,
      isPublished: products.get(row.productId).isPublished,
    },
    processingState: state.processing,
  };
}
function conflict(res, code) {
  res.writeHead(409, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ errorDetails: { title: code } }));
}
export async function handleCatalogObject(req, res, requests) {
  if (!req.url.startsWith("/synthetic-object/")) return false;
  const origin = "http://localhost:3410";
  const headers = {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "PUT, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Expose-Headers": "ETag",
  };
  if (req.method === "OPTIONS") {
    res.writeHead(204, headers);
    res.end();
    return true;
  }
  for await (const _ of req) {
  }
  requests.push({
    route: "synthetic-object",
    method: req.method,
    authorization: req.headers.authorization,
    cookie: req.headers.cookie,
  });
  res.writeHead(state.transferFailure ? 503 : 200, {
    ...headers,
    ETag: '"synthetic-etag"',
  });
  res.end();
  return true;
}
export function handleCatalogFixture(
  route,
  role,
  send,
  query,
  method,
  body,
  res,
) {
  if (route === "admin/courses/thumbnails" && method === "POST") {
    if (!["ADMIN", "SUPER_ADMIN"].includes(role)) { send(403, null); return true; }
    const failed=state.thumbnailFailure, delay=state.thumbnailDelay ?? 0;
    const url=`https://res.cloudinary.com/test/image/upload/v1/course-thumbnails/synthetic-${state.thumbnailCount=(state.thumbnailCount??0)+1}.webp`;
    setTimeout(()=>send(failed?503:201,failed?null:{url}),delay);
    return true;
  }
  if (!route.startsWith("admin/products") && !route.startsWith("admin/media"))
    return false;
  if (!["ADMIN", "SUPER_ADMIN"].includes(role)) {
    send(403, null);
    return true;
  }
  const viewProduct = row => ({...row,lessonCount:(curricula.get(row.id)??[]).length,enrollmentCount:row.enrollmentCount??0,thumbnailUrl:row.thumbnailUrl??null,previewImageUrl:(curricula.get(row.id)??[]).find(l=>l.access==='PUBLIC_DEMO')?`https://i.ytimg.com/vi/${curricula.get(row.id).find(l=>l.access==='PUBLIC_DEMO').youtubeVideoId}/hqdefault.jpg`:null});
  const p = route.split("/");
  if (route === "admin/products") {
    if (method === "GET") {
      const rows = [...products.values()].filter(
        (v) =>
          !v.deletedAt && (!query.get("slug") || v.slug === query.get("slug")) && (!query.get("search") ||
            [v.title, v.slug].some(value => value.toLowerCase().includes(query.get("search").toLowerCase()))) &&
          (!query.get("publication") ||
            (query.get("publication") === "PUBLISHED") === v.isPublished) &&
          (!query.get("type") || query.get("type") === v.type) &&
          (!query.get("contentProvider") || query.get("contentProvider") === v.contentProvider),
      );
      send(200, { items: rows.map(viewProduct), nextCursor: null });
    } else {
      if (state.createFailure) { send(503, null); return true; }
      if([...products.values()].some(p=>p.slug===body.slug)){conflict(res,'CONFLICT');return true;}
      const row = { ...base(), ...body, id: randomUUID() };
      products.set(row.id, row);
      if(state.createLostAck){state.createLostAck=false;send(503,null);}else send(201, { ...viewProduct(row), metadata: { secret: "MUST_NOT_RENDER" } });
    }
    return true;
  }
  if (p[1] === "products") {
    const row = products.get(p[2]);
    if (!row || row.deletedAt) {
      send(404, null);
      return true;
    }
    if (p[3] === "curriculum") {
      const view = () => ({productId:row.id,version:row.version,isPublished:row.isPublished,lessons:curricula.get(row.id)??[]});
      if(row.contentProvider!=="YOUTUBE"){send(404,null);return true;}
      if(method==="GET"){if(state.courseReadDelay)setTimeout(()=>send(200,view()),state.courseReadDelay);else send(200,view());return true;}
      if(body.expectedVersion!==row.version||state.conflict){conflict(res,"PRODUCT_VERSION_CONFLICT");return true;}
      if(row.isPublished){conflict(res,"COURSE_MUST_BE_UNPUBLISHED");return true;}
      curricula.set(row.id,body.lessons.map((lesson,index)=>({id:lesson.id??randomUUID(),title:lesson.title,summary:lesson.summary,access:lesson.access,position:index+1,youtubeVideoId:new URL(lesson.videoUrl).searchParams.get("v")??new URL(lesson.videoUrl).pathname.split("/").pop()})));
      row.version++;send(200,view());return true;
    }
    if (method === "GET") {
      send(200, { ...viewProduct(row), metadata: { secret: "MUST_NOT_RENDER" } });
      return true;
    }
    if (body.expectedVersion !== row.version || state.conflict) {
      conflict(res, "PRODUCT_VERSION_CONFLICT");
      return true;
    }
    if (p[3] === "actions") {
      if(body.action==='PUBLISH'&&row.contentProvider==='YOUTUBE'&&row.priceCents>0){conflict(res,'PAID_COURSE_NOT_ENABLED');return true;}
      if (body.action === "PUBLISH" && (row.contentProvider==="YOUTUBE" ? !(curricula.get(row.id)??[]).some(lesson=>lesson.access==="ENROLLED") : !row.contentS3Key)) {
        conflict(res, "ASSET_NOT_READY");
        return true;
      }
      if (body.action === "DELETE") {
        row.isPublished=false;row.version++;
        if(row.contentProvider==='YOUTUBE')row.deletedAt=new Date().toISOString();else products.delete(row.id);
        send(200, viewProduct(row));
        return true;
      }
      row.isPublished = body.action === "PUBLISH";
    } else if (p[3] === "asset") {
      row.contentS3Key =
        row.type === "VIDEO_COURSE"
          ? `hls/${row.id}/${body.uploadId}/master.m3u8`
          : `admin-assets/${row.id}/${body.uploadId}.pdf`;
    } else Object.assign(row, body);
    row.version++;
    send(200, viewProduct(row));
    return true;
  }
  if (route === "admin/media") {
    send(200, {
      items: [...uploads.values()].map(uploadView),
      nextCursor: null,
    });
    return true;
  }
  if (route === "admin/media/uploads") {
    let row = uploads.get(body.requestId);
    if (!row) {
      const owner =
        role === "ADMIN"
          ? "550e8400-e29b-41d4-a716-446655440004"
          : "550e8400-e29b-41d4-a716-446655440005";
      row = {
        id: body.requestId,
        productId: body.productId,
        ownerId: owner,
        filename: body.filename,
        contentType: body.contentType,
        fileSizeBytes: body.fileSizeBytes,
        partSizeBytes: 10485760,
        state: "UPLOADING",
        createdAt: base().createdAt,
        updatedAt: base().updatedAt,
        progress: 0,
      };
      uploads.set(row.id, row);
    }
    send(201, uploadView(row));
    return true;
  }
  const row = uploads.get(p[3]);
  if (!row) {
    send(404, null);
    return true;
  }
  if (p[4] === "part-url")
    send(200, {
      url: `http://127.0.0.1:3411/synthetic-object/${row.id}`,
      partNumber: body.partNumber,
    });
  else {
    if (p[4] === "complete") row.state = "UPLOADED";
    if (p[4] === "abort") row.state = "ABORTED";
    if (p[4] === "process") state.processing = "waiting";
    send(200, uploadView(row));
  }
  return true;
}
export async function checkAdminCatalog({
  seed,
  go,
  call,
  evaluate,
  until,
  temp,
  requests,
}) {
  let checks = 0;
  const set = async (id, value) =>
    evaluate(
      `(()=>{const e=document.getElementById(${JSON.stringify(id)});Object.getOwnPropertyDescriptor(e instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`,
    );
  for (const locale of ["bn", "en"])
    for (const role of ["ADMIN", "SUPER_ADMIN"])
      for (const width of [320, 1440]) {
        await seed(role, locale);
        await call("Emulation.setDeviceMetricsOverride", {
          width,
          height: 1000,
          deviceScaleFactor: 1,
          mobile: width < 600,
        });
        await go("/admin/products");
        await until(
          () => evaluate(`!!document.querySelector('[data-product-row]')`),
          "Product list",
        );
        assert.equal(
          await evaluate("document.documentElement.scrollWidth>innerWidth"),
          false,
        );
        await go(`/admin/products/${productId}`);
        await until(
          () => evaluate(`!!document.querySelector('[data-product-detail]')`),
          "Product detail",
        );
        assert.equal(
          await evaluate(
            `document.body.textContent.includes('MUST_NOT_RENDER')`,
          ),
          false,
        );
        await go(`/admin/products/${productId}/edit`);
        await until(
          () => evaluate(`!!document.querySelector('[data-product-form]')`),
          "Product form",
        );
        assert.equal(
          await evaluate("document.documentElement.scrollWidth>innerWidth"),
          false,
        );
        const shot = await call("Page.captureScreenshot", { format: "png" });
        await writeFile(
          path.join(temp, `catalog-${role}-${locale}-${width}.png`),
          Buffer.from(shot.data, "base64"),
        );
        await set(
          "product-title",
          `Synthetic edited ${locale} ${role} ${width}`,
        );
        await evaluate(
          `document.querySelector('[data-product-form]').requestSubmit()`,
        );
        await until(
          () => evaluate(`!!document.querySelector('[data-product-detail]')`),
          "Saved product",
        );
        assert.equal(
          products.get(productId).title,
          `Synthetic edited ${locale} ${role} ${width}`,
        );
        checks += 5;
      }
  await seed("ADMIN", "en");
  await go("/admin/products/new");
  await until(
    () => evaluate(`!!document.querySelector('#product-title')`),
    "New form",
  );
  await set("product-title", "Synthetic created product");
  await set("product-slug", "synthetic-created-product");
  await set(
    "product-description",
    "Synthetic product created through the browser.",
  );
  await set("product-priceCents", "2000");
  await evaluate(
    `document.querySelector('[data-product-form]').requestSubmit()`,
  );
  await until(
    () => evaluate(`!!document.querySelector('[data-product-detail]')`),
    "Created product",
  );
  const created = [...products.values()].find(
    (p) => p.slug === "synthetic-created-product",
  );
  assert.ok(created);
  checks++;
  await go(`/admin/products/${productId}/edit`);
  await until(
    () => evaluate(`!!document.querySelector('#product-title')`),
    "Conflict edit",
  );
  state.conflict = true;
  await set("product-title", "Stale draft preserved");
  await evaluate(
    `document.querySelector('[data-product-form]').requestSubmit()`,
  );
  await until(
    () =>
      evaluate(`document.body.textContent.includes('The product changed.')`),
    "Stale edit feedback",
  );
  assert.equal(
    await evaluate(`document.querySelector('#product-title').value`),
    "Stale draft preserved",
  );
  state.conflict = false;
  await evaluate(
    `Array.from(document.querySelectorAll('[data-product-form] button')).find(b=>b.type==='button').click()`,
  );
  await until(
    () =>
      evaluate(
        `document.querySelector('#product-title')?.value!== 'Stale draft preserved'`,
      ),
    "Explicit reload review",
  );
  checks += 2;
  await go(`/admin/products/${productId}`);
  await until(
    () => evaluate(`!!document.querySelector('#product-reason')`),
    "Publish controls",
  );
  await set("product-reason", "Publish reviewed guide");
  await evaluate(
    `document.querySelector('[data-product-action]').requestSubmit()`,
  );
  await until(
    () => evaluate(`!!document.querySelector('dialog[open]')`),
    "Publication confirmation",
  );
  await evaluate(`document.querySelector('dialog button').click()`);
  await until(
    () =>
      evaluate(
        `document.querySelector('main [role="alert"]')?.textContent.includes('Save at least one enrolled lesson')`,
      ),
    "Asset publication gate",
  );
  checks++;
  const filename = path.join(temp, "synthetic-guide.pdf");
  await writeFile(filename, "%PDF-1.4\nSynthetic controlled upload");
  await go(`/admin/media?productId=${productId}`);
  await until(
    () =>
      evaluate(
        `document.querySelector('#upload-product')?.value===${JSON.stringify(productId)}`,
      ),
    "Draft selection",
  );
  const doc = await call("DOM.getDocument"),
    node = await call("DOM.querySelector", {
      nodeId: doc.root.nodeId,
      selector: "#upload-file",
    });
  await call("DOM.setFileInputFiles", {
    nodeId: node.nodeId,
    files: [filename],
  });
  state.transferFailure = true;
  await evaluate(
    `document.querySelector('[data-upload-form]').requestSubmit()`,
  );
  await until(
    () =>
      evaluate(
        `document.querySelector('main [role="alert"]')?.textContent.includes('File transfer failed')`,
      ),
    "Transfer failure recovery",
  );
  state.transferFailure = false;
  await evaluate(
    `document.querySelector('[data-upload-form]').requestSubmit()`,
  );
  await until(
    () =>
      evaluate(
        `!!document.querySelector('[data-upload-detail] [data-attach-upload]')`,
      ),
    "Retried upload verified",
  );
  assert.equal(uploads.size, 1);
  checks += 2;
  await evaluate(`document.querySelector('[data-attach-upload]').click()`);
  await until(
    () => evaluate(`!!document.querySelector('dialog[open]')`),
    "Attachment confirmation",
  );
  await evaluate(`document.querySelector('dialog button').click()`);
  await until(
    () => evaluate(`document.body.textContent.includes('Changes saved.')`),
    "Asset attached",
  );
  assert.match(products.get(productId).contentS3Key, /admin-assets/);
  checks++;
  await go(`/admin/products/${productId}`);
  await until(
    () => evaluate(`!!document.querySelector('#product-reason')`),
    "Ready product",
  );
  await set("product-reason", "Publish verified guide");
  await evaluate(
    `document.querySelector('[data-product-action]').requestSubmit()`,
  );
  await until(
    () => evaluate(`!!document.querySelector('dialog[open]')`),
    "Publish ready confirmation",
  );
  await evaluate(`document.querySelector('dialog button').click()`);
  await until(
    () => evaluate(`document.body.textContent.includes('Changes saved.')`),
    "Published",
  );
  assert.equal(products.get(productId).isPublished, true);
  checks++;
  const videoId = randomUUID(),
    videoUpload = randomUUID();
  products.set(videoId, {
    ...base(),
    id: videoId,
    title: "Synthetic video product",
    slug: "synthetic-video-product",
    type: "VIDEO_COURSE",
  });
  const prior = [...uploads.values()][0];
  uploads.set(videoUpload, {
    ...prior,
    id: videoUpload,
    productId: videoId,
    filename: "synthetic-video.mp4",
    contentType: "video/mp4",
    state: "UPLOADED",
  });
  state.processing = "failed";
  await go(`/admin/media/uploads/${videoUpload}`);
  await until(
    () => evaluate(`!!document.querySelector('[data-process-upload]')`),
    "Failed video recovery",
  );
  assert.equal(
    await evaluate(`document.body.textContent.includes('Processing failed')`),
    true,
  );
  await evaluate(`document.querySelector('[data-process-upload]').click()`);
  await until(
    () => evaluate(`document.querySelector('[data-process-upload]')?.disabled`),
    "Queued video cannot be duplicated",
  );
  checks += 2;
  state.processing = "completed";
  await evaluate(
    `Array.from(document.querySelectorAll('main button')).find(b=>b.textContent.trim()==='Refresh status').click()`,
  );
  await until(
    () => evaluate(`!!document.querySelector('[data-attach-upload]')`),
    "Ready video attachment",
  );
  await evaluate(`document.querySelector('[data-attach-upload]').click()`);
  await until(
    () => evaluate(`!!document.querySelector('dialog[open]')`),
    "Video attachment confirmation",
  );
  await evaluate(`document.querySelector('dialog button').click()`);
  await until(
    () => evaluate(`document.body.textContent.includes('Changes saved.')`),
    "Video attached",
  );
  assert.equal(
    products.get(videoId).contentS3Key,
    `hls/${videoId}/${videoUpload}/master.m3u8`,
  );
  checks++;
  const abortedId = randomUUID();
  uploads.set(abortedId, {
    ...prior,
    id: abortedId,
    filename: "synthetic-abort.pdf",
    state: "UPLOADING",
  });
  await go(`/admin/media/uploads/${abortedId}`);
  await until(
    () => evaluate(`!!document.querySelector('#resume-file')`),
    "Interrupted upload recovery",
  );
  await evaluate(
    `Array.from(document.querySelectorAll('main button')).find(b=>b.textContent.trim()==='Abort upload').click()`,
  );
  await until(
    () => evaluate(`!!document.querySelector('dialog[open]')`),
    "Abort confirmation",
  );
  await evaluate(`document.querySelector('dialog button').click()`);
  await until(
    () => evaluate(`document.body.textContent.includes('Aborted')`),
    "Aborted session",
  );
  assert.equal(uploads.get(abortedId).state, "ABORTED");
  checks++;
  await call("Emulation.setDeviceMetricsOverride", {
    width: 320,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await go("/admin/media");
  await until(
    () => evaluate(`!!document.querySelector('[data-upload-row]')`),
    "Mobile media inventory",
  );
  assert.equal(
    await evaluate("document.documentElement.scrollWidth>innerWidth"),
    false,
  );
  checks++;
  const mediaShot = await call("Page.captureScreenshot", { format: "png" });
  await writeFile(
    path.join(temp, "media-ADMIN-en-320.png"),
    Buffer.from(mediaShot.data, "base64"),
  );
  await go(`/admin/products/${created.id}`);
  await until(
    () => evaluate(`!!document.querySelector('#product-action')`),
    "Delete product action",
  );
  await evaluate(
    `(()=>{const e=document.getElementById('product-action');e.value='DELETE';e.dispatchEvent(new Event('change',{bubbles:true}));})()`,
  );
  await set("product-reason", "Delete obsolete synthetic product");
  await evaluate(
    `document.querySelector('[data-product-action]').requestSubmit()`,
  );
  await until(
    () => evaluate(`!!document.querySelector('dialog[open]')`),
    "Deletion confirmation",
  );
  await evaluate(`document.querySelector('dialog button').click()`);
  await until(
    () => evaluate(`!!document.querySelector('[data-admin-products]')`),
    "Deleted product directory",
  );
  assert.equal(products.has(created.id), false);
  checks++;
  state.processing = "idle";
  for (const role of ["LEARNER", "VET", "FARMER", "BUYER"]) {
    await seed(role, "en");
    await go("/admin/products", "/account/profile");
    assert.equal(
      await evaluate(`!!document.querySelector('[data-admin-products]')`),
      false,
    );
    checks++;
  }
  const puts = requests.filter((r) => r.route === "synthetic-object");
  assert.equal(puts.length, 2);
  assert.equal(
    puts.every((r) => !r.authorization && !r.cookie),
    true,
  );
  checks++;
  checks += await checkAdminYouTube({seed,go,call,evaluate,until,temp,set,products,curricula,state});
  checks += await checkAdminCourses({seed,go,call,evaluate,until,temp,requests});
  products.clear();
  curricula.clear();
  products.set(productId, base());
  uploads.clear();
  console.log(`Passed ${checks} admin catalog/media checks.`);
  return checks;
}

export function checkAdminCourses(context) {
  return checkAdminCourseManagement({ ...context, products, curricula, state });
}
