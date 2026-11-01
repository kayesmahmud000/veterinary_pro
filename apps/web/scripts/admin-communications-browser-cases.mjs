import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";
const id = "d7000000-0000-4000-8000-000000000201",
  ticketId = "d7000000-0000-4000-8000-000000000202",
  noticeId = "d7000000-0000-4000-8000-000000000203",
  date = "2026-10-19T00:00:00Z";
const requester = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  name: "Synthetic requester",
};
let document, ticket, notice;
export const communicationsState = { failure: false, conflict: false };
function reset() {
  communicationsState.failure = false;
  communicationsState.conflict = false;
  const draft = {
    bn: {
      title: "পরীক্ষার প্রকাশনা",
      summary: "পরীক্ষার সারাংশ",
      body: "নমুনা বাংলা লেখা <script>window.ADM7_UNSAFE=true</script>",
    },
    en: {
      title: "Synthetic publication",
      summary: "Synthetic public summary",
      body: "Synthetic article <img src=x onerror=window.ADM7_UNSAFE=true>",
    },
  };
  document = {
    id,
    kind: "BLOG",
    slug: "synthetic-publication",
    title: { bn: draft.bn.title, en: draft.en.title },
    draft,
    published: null,
    subjectUserId: null,
    version: 1,
    publishedAt: null,
    updatedAt: date,
    revisions: [],
    revisionsTruncated: false,
  };
  ticket = {
    id: ticketId,
    subject: "Synthetic account support question",
    category: "ACCOUNT",
    status: "OPEN",
    version: 1,
    requester,
    assignee: null,
    farmId: null,
    orderId: null,
    createdAt: date,
    updatedAt: date,
    messages: [
      {
        id: "d7000000-0000-4000-8000-000000000204",
        author: requester,
        internal: false,
        body: "Synthetic initial message",
        createdAt: date,
      },
    ],
    messagesTruncated: false,
    events: [],
    eventsTruncated: false,
  };
  notice = {
    id: noticeId,
    source: "ROLE_EMAIL",
    status: "FAILED",
    recipient: requester,
    channel: "EMAIL",
    category: "ROLE_REQUEST_APPROVED",
    attempts: 5,
    createdAt: date,
    acceptedAt: null,
    generation: 0,
    canRetry: true,
  };
}
reset();
export function handleCommunicationsFixture(req, res, data, route, role) {
  const match =
    /^(?:admin\/(?:content|support|notifications)(?:\/|$)|support\/tickets(?:\/|$)|content\/)/.test(
      route,
    );
  if (!match) return false;
  const send = (status, value, code) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        success: status < 400,
        data: value,
        ...(code ? { errorDetails: { title: code } } : {}),
      }),
    );
    return true;
  };
  if (communicationsState.failure) return send(503, null);
  const parts = route.split("/"),
    q = new URL(req.url, "http://fixture").searchParams;
  if (parts[0] === "content") {
    const publicRow = document.published
      ? {
          id,
          kind: document.kind,
          slug: document.slug,
          content: document.published,
          publishedAt: document.publishedAt,
          verified: document.kind === "VET",
        }
      : null;
    if (parts[2])
      return publicRow &&
        parts[2] === publicRow.slug &&
        parts[1] === publicRow.kind
        ? send(200, publicRow)
        : send(404, null);
    return send(200, {
      items: publicRow && parts[1] === publicRow.kind ? [publicRow] : [],
      nextCursor: null,
    });
  }
  if (parts[0] === "admin" && !["ADMIN", "SUPER_ADMIN"].includes(role))
    return send(403, null);
  const own = parts[0] === "support",
    kind = own ? "support" : parts[1],
    entity = parts[2],
    suffix = parts[3];
  const safeTicket = () => ({
    ...ticket,
    messages: own
      ? ticket.messages.filter((m) => !m.internal)
      : ticket.messages,
    events: own ? [] : ticket.events,
  });
  if (req.method === "GET") {
    if (kind === "content")
      return entity
        ? send(entity === document.id ? 200 : 404, document)
        : send(200, {
            items:
              !q.get("search") || document.slug.includes(q.get("search"))
                ? [document]
                : [],
            nextCursor: null,
          });
    if (kind === "notifications")
      return send(200, {
        items:
          q.get("source") === "CONSULTATION"
            ? [
                {
                  ...notice,
                  source: "CONSULTATION",
                  channel: "IN_APP",
                  status: "RECORDED_UNVERIFIED",
                  canRetry: false,
                },
              ]
            : [notice],
        nextCursor: null,
      });
    if (own && role !== "LEARNER") return send(404, null);
    return entity
      ? send(entity === ticket.id ? 200 : 404, safeTicket())
      : send(200, { items: [safeTicket()], nextCursor: null });
  }
  if (communicationsState.conflict)
    return send(409, null, "COMMUNICATION_CONFLICT");
  if (kind === "content" && !entity) {
    document = {
      ...document,
      ...data,
      version: 1,
      published: null,
      publishedAt: null,
      revisions: [],
      subjectUserId: data.subjectUserId ?? null,
      title: { bn: data.draft.bn.title, en: data.draft.en.title },
    };
    return send(201, document);
  }
  if (kind === "support" && !entity) {
    ticket = {
      ...ticket,
      id: data.id,
      subject: data.subject,
      category: data.category,
      version: 1,
      status: "OPEN",
      assignee: null,
      messages: [
        {
          id: data.messageId,
          author: requester,
          internal: false,
          body: data.body,
          createdAt: date,
        },
      ],
    };
    return send(201, safeTicket());
  }
  if (
    (suffix === "actions" || suffix === "retry") &&
    data.actorPassword !== "DemoPassword123!"
  )
    return send(403, null, "PASSWORD_CONFIRMATION_FAILED");
  if (kind === "notifications") {
    notice = {
      ...notice,
      generation: notice.generation + 1,
      status: "PENDING",
      canRetry: false,
    };
    return send(200, notice);
  }
  const row = kind === "content" ? document : ticket;
  if (data.expectedVersion !== row.version)
    return send(409, null, "COMMUNICATION_CONFLICT");
  row.version++;
  if (kind === "content") {
    if (suffix === "save") {
      row.draft = data.draft;
      row.title = { bn: data.draft.bn.title, en: data.draft.en.title };
      row.revisions.unshift({
        version: row.version,
        draft: data.draft,
        createdAt: date,
      });
    } else if (data.action === "PUBLISH") {
      row.published = structuredClone(row.draft);
      row.publishedAt = date;
    } else {
      row.published = null;
      row.publishedAt = null;
    }
    return send(200, row);
  }
  if (data.action === "ASSIGN")
    row.assignee = data.assigneeId
      ? { id: data.assigneeId, name: "Synthetic assignee" }
      : null;
  else if (data.action === "STATUS") row.status = data.status;
  else
    row.messages.push({
      id: data.messageId,
      author: own
        ? requester
        : {
            id: "550e8400-e29b-41d4-a716-446655440004",
            name: "Synthetic admin",
          },
      internal: own ? false : data.internal,
      body: data.body,
      createdAt: date,
    });
  return send(200, safeTicket());
}
export async function checkAdminCommunications({
  seed,
  go,
  call,
  evaluate,
  until,
  temp,
  requests,
}) {
  let checks = 0;
  const set = (id, value) =>
    evaluate(
      `(()=>{const el=document.getElementById(${JSON.stringify(id)});const proto=el.tagName==='SELECT'?HTMLSelectElement.prototype:el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`,
    );
  const waitText = (text) =>
    until(
      () =>
        evaluate(
          `document.querySelector('main').textContent.includes(${JSON.stringify(text)})`,
        ),
      text,
    );
  const confirm = async (title, password = "DemoPassword123!") => {
    const selector = `Array.from(document.querySelectorAll('[data-communications] section')).find(s=>s.querySelector('h3')?.textContent===${JSON.stringify(title)})`;
    await until(
      () =>
        evaluate(`!!(${selector})?.querySelector('form input[type=password]')`),
      "Action ready",
    );
    const fields = await evaluate(
      `(()=>{const section=${selector};return {reason:section.querySelector('form textarea').id,password:section.querySelector('form input[type=password]').id};})()`,
    );
    await set(fields.reason, "Reviewed synthetic communications action");
    await set(fields.password, password);
    await evaluate(`(${selector}).querySelector('form').requestSubmit()`);
    await until(
      () => evaluate(`!!document.querySelector('dialog[open]')`),
      "Confirmation shown",
    );
    await evaluate(`document.querySelector('dialog[open] button').click()`);
    await until(
      () => evaluate(`!document.querySelector('dialog[open]')`),
      "Action completed",
    );
  };
  for (const role of ["ADMIN", "SUPER_ADMIN"])
    for (const locale of ["bn", "en"])
      for (const width of [320, 1440]) {
        reset();
        await seed(role, locale);
        await call("Emulation.setDeviceMetricsOverride", {
          width,
          height: 1000,
          deviceScaleFactor: 1,
          mobile: width < 600,
        });
        await go("/admin/content");
        await waitText(
          locale === "bn" ? "পরীক্ষার প্রকাশনা" : "Synthetic publication",
        );
        checks++;
        await go(`/admin/content/${id}`);
        await until(
          () => evaluate(`!!document.getElementById('en-body')`),
          "Draft editor loaded",
        );
        assert.equal(await evaluate(`window.ADM7_UNSAFE===true`), false);
        assert.equal(
          await evaluate(
            `!!document.querySelector('[data-communications] img,[data-communications] script')`,
          ),
          false,
        );
        checks += 2;
        const body = "Persisted synthetic draft " + locale;
        await set("en-body", body);
        await evaluate(
          `document.getElementById('en-body').closest('form').requestSubmit()`,
        );
        await waitText(
          locale === "bn" ? "সফলভাবে সংরক্ষিত" : "Saved successfully",
        );
        checks++;
        await confirm(
          locale === "bn"
            ? "সংরক্ষিত খসড়া প্রকাশ করুন"
            : "Publish saved draft",
        );
        checks++;
        await go("/blog/synthetic-publication");
        await waitText(
          locale === "bn" ? "পরীক্ষার প্রকাশনা" : "Synthetic publication",
        );
        assert.equal(await evaluate(`window.ADM7_UNSAFE===true`), false);
        checks++;
        await go("/admin/notifications");
        await waitText(
          locale === "bn"
            ? "ভূমিকার আবেদন অনুমোদিত"
            : "Role application approved",
        );
        await confirm(
          locale === "bn"
            ? "ইমেইল পুনরায় পাঠানোর অনুরোধ"
            : "Request email retry",
        );
        await waitText(locale === "bn" ? "অপেক্ষমাণ" : "Pending");
        checks++;
        await go(`/admin/support/${ticketId}`);
        await waitText("Synthetic initial message");
        await set("reply-body", "PRIVATE-BROWSER-NOTE");
        await evaluate(
          `document.querySelector('#reply-body').closest('section').querySelector('input[type=checkbox]').click()`,
        );
        await confirm(locale === "bn" ? "অভ্যন্তরীণ নোট" : "Internal note");
        await waitText("PRIVATE-BROWSER-NOTE");
        checks++;
        assert.equal(
          await evaluate(`document.documentElement.scrollWidth<=innerWidth+1`),
          true,
        );
        checks++;
        if (width === 320 || width === 1440) {
          const shot = await call("Page.captureScreenshot", { format: "png" });
          await writeFile(
            path.join(temp, `adm7-${role}-${locale}-${width}.png`),
            Buffer.from(shot.data, "base64"),
          );
        }
        await seed("LEARNER", locale);
        await go(`/account/support/${ticketId}`);
        await waitText("Synthetic initial message");
        assert.equal(
          await evaluate(
            `document.querySelector('main').textContent.includes('PRIVATE-BROWSER-NOTE')`,
          ),
          false,
        );
        checks++;
      }
  reset();
  await seed("ADMIN", "en");
  await go(`/admin/content/${id}`);
  await until(
    () => evaluate(`!!document.getElementById('en-body')`),
    "Editor ready for failure",
  );
  communicationsState.conflict = true;
  await set("en-body", "Draft preserved on failure");
  await evaluate(
    `document.getElementById('en-body').closest('form').requestSubmit()`,
  );
  await waitText("record may have changed");
  assert.equal(
    await evaluate(`document.getElementById('en-body').value`),
    "Draft preserved on failure",
  );
  checks++;
  communicationsState.conflict = false;
  await evaluate(
    `(()=>{const original=window.confirm;window.confirm=()=>true;try{Array.from(document.querySelectorAll('main button')).find(b=>b.textContent.includes('Reload saved draft')).click()}finally{window.confirm=original}})()`,
  );
  await until(
    () =>
      evaluate(
        `!!document.getElementById('en-body')&&!document.getElementById('en-body').matches(':disabled')&&document.getElementById('en-body').value!=='Draft preserved on failure'`,
      ),
    "Explicit reload restores saved draft",
  );
  checks++;
  await confirm("Publish saved draft", "incorrect-password");
  await waitText("Password did not match");
  assert.equal(
    await evaluate(
      `Array.from(document.querySelectorAll('main input[type=password]')).every(e=>e.value==='')`,
    ),
    true,
  );
  checks++;
  await confirm("Publish saved draft");
  await confirm("Remove publication");
  assert.equal(
    await evaluate(`fetch('/blog/synthetic-publication').then(r=>r.status)`),
    404,
  );
  checks++;
  await go(`/admin/support/${ticketId}`);
  await waitText("Synthetic initial message");
  await set("assignee-id", "550e8400-e29b-41d4-a716-446655440005");
  await confirm("Change assignment");
  await waitText("Synthetic assignee");
  checks++;
  await set("ticket-status", "CLOSED");
  await confirm("Change status");
  assert.equal(
    await evaluate(`!!document.getElementById('reply-body')`),
    false,
  );
  checks++;
  await set("ticket-status", "OPEN");
  await confirm("Change status");
  await seed("LEARNER", "en");
  await go(`/account/support/${ticketId}`);
  await until(
    () => evaluate(`!!document.getElementById('reply-body')`),
    "Requester reply ready",
  );
  await set("reply-body", "Public requester follow-up");
  await evaluate(
    `Array.from(document.querySelectorAll('main button')).find(b=>b.textContent==='Send message').click()`,
  );
  await waitText("Public requester follow-up");
  checks++;
  await go("/account/support");
  await until(
    () => evaluate(`!!document.getElementById('support-subject')`),
    "Own ticket form ready",
  );
  await evaluate(
    `document.getElementById('support-subject').closest('details').open=true`,
  );
  await set("support-subject", "Created through browser support");
  await set("support-message", "Synthetic new in-app support message");
  await evaluate(
    `document.getElementById('support-subject').closest('form').requestSubmit()`,
  );
  await waitText("Synthetic new in-app support message");
  checks++;
  await seed("ADMIN", "en");
  await go("/admin/notifications");
  await until(
    () => evaluate(`!!document.getElementById('source')`),
    "Notification source ready",
  );
  await set("source", "CONSULTATION");
  await evaluate(
    `document.getElementById('source').closest('form').requestSubmit()`,
  );
  await waitText("Recorded, delivery unverified");
  assert.equal(
    await evaluate(`!!document.querySelector('main input[type=password]')`),
    false,
  );
  checks++;
  await go("/admin/content");
  await waitText("Synthetic publication");
  communicationsState.failure = true;
  await set("search", "failed filtered query");
  await evaluate(
    `document.getElementById('search').closest('form').requestSubmit()`,
  );
  await until(
    () => evaluate(`!!document.querySelector('main [role=alert]')`),
    "Filtered list failure",
  );
  assert.equal(
    await evaluate(
      `Array.from(document.querySelectorAll('main a')).some(a=>a.textContent==='Synthetic publication')`,
    ),
    false,
  );
  checks++;
  communicationsState.failure = false;
  await go("/admin/content");
  await until(
    () => evaluate(`!!document.getElementById('create-slug')`),
    "Content create form ready",
  );
  await evaluate(
    `document.getElementById('create-slug').closest('details').open=true`,
  );
  await set("create-slug", "browser-created-draft");
  for (const locale of ["bn", "en"]) {
    await set(
      `${locale}-title`,
      locale === "bn"
        ? "ব্রাউজারে নতুন খসড়া"
        : "Created through browser content",
    );
    await set(`${locale}-summary`, "Synthetic summary");
    await set(`${locale}-body`, "Synthetic persisted body");
  }
  await evaluate(
    `document.getElementById('create-slug').closest('form').requestSubmit()`,
  );
  await until(
    () =>
      evaluate(
        `location.pathname.startsWith('/admin/content/')&&!!document.getElementById('en-body')`,
      ),
    "Created draft opens persistent editor",
  );
  assert.equal(
    await evaluate(`document.getElementById('en-body').value`),
    "Synthetic persisted body",
  );
  checks++;
  reset(); document.kind="VET"; document.subjectUserId="550e8400-e29b-41d4-a716-446655440003";
  await go(`/admin/content/${id}`);await until(()=>evaluate(`!!document.getElementById('verification-note')`),"Veterinarian verification ready");
  assert.equal(await evaluate(`Array.from(document.querySelectorAll('section')).find(s=>s.querySelector('h3')?.textContent==='Publish saved draft').querySelector('form fieldset').disabled`),true);checks++;
  assert.equal(await evaluate(`!!document.querySelector('main a[href="/admin/veterinarians/550e8400-e29b-41d4-a716-446655440003"]')`),true);checks++;
  await evaluate(`document.getElementById('verification-note').closest('section').querySelector('input[type=checkbox]').click()`);await set("verification-note","PRIVATE-VERIFICATION: synthetic license and identity reviewed");
  await confirm("Publish saved draft");await go("/doctors/synthetic-publication");await waitText("Identity and qualifications reviewed");
  assert.equal(await evaluate(`document.querySelector('main').textContent.includes('PRIVATE-VERIFICATION')`),false);checks++;
  for (const role of ["LEARNER", "FARMER", "BUYER", "VET"]) {
    await seed(role, "en");
    await go("/admin/content", "/account/profile");
    checks++;
  }
  assert.equal(
    requests.some((r) => /send-email|refund|transfer|capture/.test(r.route)),
    false,
  );
  checks++;
  console.log(
    `Passed ${checks} ADM7 production browser checks. Screenshots: ${temp}`,
  );
  return checks;
}
