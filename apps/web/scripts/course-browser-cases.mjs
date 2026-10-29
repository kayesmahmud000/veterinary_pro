import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";
const id = "cc0e8400-e29b-41d4-a716-446655440001",
  mainId = "cc0e8400-e29b-41d4-a716-446655440002",
  demoId = "cc0e8400-e29b-41d4-a716-446655440003",
  lastId = "cc0e8400-e29b-41d4-a716-446655440007";
const memberships = new Map();
const fixture = {
  failEnrollment: false,
  published: true,
  failCatalog: false,
  empty: false,
  failPlayback: false,
  slowPlayback: false,
};
const course = {
  id,
  slug: "synthetic-free-course",
  title: "Synthetic free course",
  description: "Synthetic video lessons for controlled browser acceptance.",
  provider: "YOUTUBE",
  access: "FREE_ENROLLMENT",
  thumbnailUrl: "https://i.ytimg.com/vi/DemoVid_001/hqdefault.jpg",
  lessonCount: 3,
  demoCount: 1,
  firstLessonId: mainId,
  lessons: [
    {
      id: mainId,
      title: "Synthetic main lesson",
      summary: "",
      access: "ENROLLED",
      position: 1,
    },
    {
      id: demoId,
      title: "Synthetic public demo",
      summary: "",
      access: "PUBLIC_DEMO",
      position: 2,
    },
    {
      id: lastId,
      title:
        "Selected advanced lesson — ব্যবহারিক খামার ব্যবস্থাপনার পরবর্তী ধাপ",
      summary:
        "A longer lesson summary for responsive learning layout verification.",
      access: "ENROLLED",
      position: 3,
    },
  ],
};
const catalog = [
  course,
  {
    ...course,
    id: "cc0e8400-e29b-41d4-a716-446655440005",
    slug: "synthetic-no-image",
    title: "Synthetic course without artwork",
    thumbnailUrl: null,
  },
  {
    ...course,
    id: "cc0e8400-e29b-41d4-a716-446655440006",
    slug: "synthetic-broken-image",
    title: "Synthetic unavailable artwork",
    thumbnailUrl: "https://i.ytimg.com/vi/Broken_0001/hqdefault.jpg",
  },
];
const playback = (lessonId) => ({
  productId: id,
  lessonId,
  title:
    lessonId === mainId
      ? "Synthetic main lesson"
      : lessonId === lastId
        ? course.lessons[2].title
        : "Synthetic public demo",
  provider: "YOUTUBE",
  videoId: fixture.realProvider
    ? "M7lc1UVf-VE"
    : lessonId === mainId
      ? "MainVid_001"
      : lessonId === lastId
        ? "LastVid_001"
        : "DemoVid_001",
});
export function handleCourseFixture(
  route,
  role,
  send,
  query,
  method,
  body,
  res,
  actorId = role,
) {
  if (!route.startsWith("courses") && !route.startsWith("me/courses"))
    return false;
  const error = (code, status = 403) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ errorDetails: { title: code } }));
  };
  if (!fixture.published) {
    send(404, null);
    return true;
  }
  if (route === "courses") {
    if (fixture.failCatalog) {
      fixture.failCatalog = false;
      send(503, null);
      return true;
    }
    const term = (query.get("search") ?? "").toLowerCase();
    const reply = () =>
      send(200, {
        items: fixture.empty
          ? []
          : catalog.filter(
              (item) =>
                !term ||
                `${item.title} ${item.description}`
                  .toLowerCase()
                  .includes(term),
            ),
        nextCursor: null,
      });
    if (term === "slow") setTimeout(reply, 400);
    else reply();
    return true;
  }
  if (route === `courses/slug/${encodeURIComponent("গরুর-স্বাস্থ্য")}`) {
    send(200,{...course,slug:"গরুর-স্বাস্থ্য",title:"Bangla slug course"});
    return true;
  }
  if (route.startsWith("courses/slug/")) {
    const found = catalog.find((item) => item.slug === route.split("/").at(-1));
    send(found ? 200 : 404, found ?? null);
    return true;
  }
  if (route === `courses/${id}/lessons/${demoId}/demo-playback`) {
    send(200, playback(demoId));
    return true;
  }
  if (route === `me/courses`) {
    send(200, {
      items: memberships.has(actorId)
        ? [{ ...course, enrollment: memberships.get(actorId) }]
        : [],
      nextCursor: null,
    });
    return true;
  }
  if (route === `me/courses/${id}`) {
    send(200, { ...course, enrollment: memberships.get(actorId) ?? null });
    return true;
  }
  if (route === `me/courses/${id}/enrollment` && method === "POST") {
    if (!memberships.has(actorId))
      memberships.set(actorId, {
        id: "cc0e8400-e29b-41d4-a716-446655440004",
        productId: id,
        createdAt: "2026-10-15T00:00:00Z",
      });
    if (fixture.failEnrollment) {
      fixture.failEnrollment = false;
      send(503, null);
    } else send(200, memberships.get(actorId));
    return true;
  }
  if (
    [
      `me/courses/${id}/lessons/${mainId}/playback`,
      `me/courses/${id}/lessons/${demoId}/playback`,
      `me/courses/${id}/lessons/${lastId}/playback`,
    ].includes(route)
  ) {
    if (fixture.slowPlayback) {
      fixture.slowPlayback = false;
      setTimeout(
        () =>
          send(
            200,
            playback(
              route.includes(mainId)
                ? mainId
                : route.includes(lastId)
                  ? lastId
                  : demoId,
            ),
          ),
        500,
      );
    } else if (fixture.failPlayback) {
      fixture.failPlayback = false;
      send(503, null);
    } else if (!memberships.has(actorId)) error("COURSE_ENROLLMENT_REQUIRED");
    else
      send(
        200,
        playback(
          route.includes(mainId)
            ? mainId
            : route.includes(lastId)
              ? lastId
              : demoId,
        ),
      );
    return true;
  }
  send(404, null);
  return true;
}
// Read-only real provider check; API/identity/content are still synthetic.
export async function checkRealCourseProvider({
  seed,
  go,
  call,
  evaluate,
  until,
  temp,
  origin,
}) {
  fixture.realProvider = true;
  const script = await call("Page.addScriptToEvaluateOnNewDocument", {
    source: `window.__providerErrors=[];window.onYouTubeIframeAPIReady=()=>{const Original=window.YT.Player;window.YT.Player=function(frame,options){const error=options.events.onError;options.events.onError=event=>{window.__providerErrors.push(event.data);error(event);};const player=new Original(frame,options);window.__realPlayer=player;return player;};};`,
  });
  try {
    await seed("LEARNER", "en");
    for (const name of ["vetralink_access", "vetralink_refresh"])
      await call("Network.deleteCookies", { name, url: origin });
    await call("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await go(`/courses/${course.slug}`);
    await until(
      () => evaluate(`!!document.querySelector('[data-demo-lesson]')`),
      "Real provider demo entry",
    );
    await evaluate(`document.querySelector('[data-demo-lesson]').click()`);
    await until(
      () =>
        evaluate(
          `!!document.querySelector('[data-course-player] [role="alert"]') || (window.__realPlayer && !document.querySelector('[data-course-player] [role="status"]'))`,
        ),
      "Real YouTube readiness",
      25000,
    );
    const error = await evaluate(
      `document.querySelector('[data-course-player] [role="alert"]')?.textContent`,
    );
    assert.equal(
      error,
      undefined,
      `Actual provider error: ${error}; codes ${await evaluate("window.__providerErrors")}`,
    );
    console.log("Real YouTube IFrame API reached onReady.");
    await evaluate(
      `document.querySelector('[data-youtube-player]').scrollIntoView({block:'center',behavior:'instant'});new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`,
    );
    const bounds = await evaluate(
      `(()=>{const r=document.querySelector('[data-youtube-player]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`,
    );
    assert.ok(
      bounds.y > 0 && bounds.y < 1000,
      "Real player click is inside the visible viewport",
    );
    await call("Input.dispatchMouseEvent", { type: "mouseMoved", ...bounds });
    await call("Input.dispatchMouseEvent", {
      type: "mousePressed",
      ...bounds,
      button: "left",
      clickCount: 1,
    });
    await call("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      ...bounds,
      button: "left",
      clickCount: 1,
    });
    await until(
      () =>
        evaluate(
          `window.__realPlayer?.getPlayerState()===1 && window.__realPlayer?.getCurrentTime()>0`,
        ),
      "Real YouTube sample playing",
      25000,
    );
    const start = await evaluate("window.__realPlayer.getCurrentTime()");
    await new Promise((resolve) => setTimeout(resolve, 2000));
    assert.ok(
      (await evaluate("window.__realPlayer.getCurrentTime()")) > start,
      "Actual playback time advances",
    );
    const shot = await call("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: true,
    });
    await writeFile(
      path.join(temp, "course-real-provider-1440.png"),
      Buffer.from(shot.data, "base64"),
    );
    console.log(
      `Passed real YouTube sample readiness/playback check. Screenshots: ${temp}`,
    );
    return 2;
  } catch (error) {
    console.log(
      "Real provider observation:",
      await evaluate(
        `JSON.stringify({state:window.__realPlayer?.getPlayerState?.(),time:window.__realPlayer?.getCurrentTime?.(),duration:window.__realPlayer?.getDuration?.(),errors:window.__providerErrors})`,
      ).catch(() => "unavailable"),
    );
    const shot = await call("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: true,
    });
    await writeFile(
      path.join(temp, "course-real-provider-failure.png"),
      Buffer.from(shot.data, "base64"),
    );
    console.log(
      `Provider failure screenshot: ${temp}/course-real-provider-failure.png`,
    );
    throw error;
  } finally {
    await evaluate("window.__realPlayer?.pauseVideo()").catch(() => {});
    await call("Page.removeScriptToEvaluateOnNewDocument", {
      identifier: script.identifier,
    });
    fixture.realProvider = false;
  }
}
export async function checkLearnerCourses({
  seed,
  go,
  call,
  evaluate,
  until,
  temp,
  requests,
  origin,
  subscribe,
  replaceLearner,
}) {
  let checks = 0;
  const script = await call("Page.addScriptToEvaluateOnNewDocument", {
    source: `window.__players=[];window.__destroyed=0;window.YT={Player:class{constructor(frame,options){this.frame=frame;window.__players.push({src:frame.src,events:options.events});const mode=sessionStorage.getItem('synthetic-player-mode');if(mode!=='hang')setTimeout(()=>mode==='error'?options.events.onError({data:100}):options.events.onReady(),0);}destroy(){window.__destroyed++;this.frame.remove();}}};`,
  });
  await call("Network.setBlockedURLs", {
    urls: ["*youtube-nocookie.com/*", "*youtube.com/iframe_api*"],
  });
  let imageRequests = 0,
    sessionUnavailable = false,
    previousLearner;
  const unsubscribe = subscribe("Fetch.requestPaused", (event) => {
    if (event.request.url === `${origin}/api/auth/session`) {
      if (sessionUnavailable)
        void call("Fetch.fulfillRequest", {
          requestId: event.requestId,
          responseCode: 503,
          responseHeaders: [
            { name: "Content-Type", value: "application/json" },
          ],
          body: Buffer.from(
            JSON.stringify({ user: null, code: "unavailable" }),
          ).toString("base64"),
        });
      else void call("Fetch.continueRequest", { requestId: event.requestId });
      return;
    }
    imageRequests++;
    void (async () => {
      if (event.request.url.includes("Broken_0001"))
        await call("Fetch.fulfillRequest", {
          requestId: event.requestId,
          responseCode: 404,
          body: "",
        });
      else {
        await new Promise((resolve) => setTimeout(resolve, 350));
        await call("Fetch.fulfillRequest", {
          requestId: event.requestId,
          responseCode: 200,
          responseHeaders: [
            { name: "Content-Type", value: "image/svg+xml" },
            { name: "Cache-Control", value: "public, max-age=3600" },
          ],
          body: Buffer.from(
            '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="270"><rect width="480" height="270" fill="#214e3a"/><circle cx="365" cy="70" r="34" fill="#eac474"/><path d="M0 230L155 85 300 230 390 145 480 230V270H0Z" fill="#467357"/><text x="25" y="245" fill="white" font-size="24">Practical learning · Demo</text></svg>',
          ).toString("base64"),
        });
      }
    })().catch(() => {});
  });
  await call("Fetch.enable", {
    patterns: [
      { urlPattern: "https://i.ytimg.com/*" },
      { urlPattern: `${origin}/api/auth/session` },
    ],
  });
  const set = async (selector, value) =>
    evaluate(
      `(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`,
    );
  try {
    await seed("LEARNER", "en");
    await go("/account/courses");
    await until(
      () => evaluate(`!!document.querySelector('[data-course-library]')`),
      "Focused learner library",
    );
    assert.equal(
      await evaluate(`!!document.querySelector('[data-workspace-shell]')`),
      false,
      "Learner routes do not mount dashboard sidebar",
    );
    checks++;
    for (const locale of ["bn", "en"])
      for (const width of [320, 768, 1440]) {
        memberships.clear();
        await seed("LEARNER", locale);
        await call("Network.deleteCookies", {
          name: "vetralink_access",
          url: origin,
        });
        await call("Network.deleteCookies", {
          name: "vetralink_refresh",
          url: origin,
        });
        await call("Emulation.setDeviceMetricsOverride", {
          width,
          height: 1000,
          deviceScaleFactor: 1,
          mobile: width < 600,
        });
        await go("/courses");
        await until(
          () => evaluate(`!!document.querySelector('[data-course-card]')`),
          "Public course catalog",
        );
        checks++;
        assert.equal(
          await evaluate(
            `(()=>{const r=document.querySelector('main').getBoundingClientRect();return r.left>5 && r.width<innerWidth*.94;})()`,
          ),
          true,
          "Public course container retains shared margins",
        );
        checks++;
        assert.equal(
          await evaluate(
            `(()=>{const form=document.querySelector('main form'),input=document.querySelector('#course-search');return input.getBoundingClientRect().width>form.getBoundingClientRect().width*.55;})()`,
          ),
          true,
          "Search uses available panel width",
        );
        checks++;
        await until(
          () =>
            evaluate(
              `document.querySelector('[data-course-artwork] img')?.complete`,
            ),
          "Delayed preview image loaded",
        );
        await until(
          () =>
            evaluate(
              `getComputedStyle(document.querySelector('[data-course-artwork-fallback]')).display==='none'`,
            ),
          "Loaded artwork hides fallback",
        );
        checks++;
        await until(
          () =>
            evaluate(
              `document.querySelectorAll('[data-course-artwork] img').length===1`,
            ),
          "Broken thumbnail removed; missing thumbnail uses fallback",
        );
        assert.equal(
          await evaluate(
            `document.querySelectorAll('[data-course-card]').length`,
          ),
          3,
        );
        checks++;
        const catalogShot = await call("Page.captureScreenshot", {
          format: "png",
          captureBeyondViewport: true,
        });
        await writeFile(
          path.join(temp, `course-catalog-${locale}-${width}.png`),
          Buffer.from(catalogShot.data, "base64"),
        );
        const beforeTyping = imageRequests;
        await set("#course-search", "no match");
        assert.equal(
          imageRequests,
          beforeTyping,
          "Typing does not reload artwork",
        );
        checks++;
        await evaluate(`document.querySelector('main form').requestSubmit()`);
        await until(
          () => evaluate(`!!document.querySelector('[data-course-empty]')`),
          "Search empty result",
        );
        checks++;
        await evaluate(`document.querySelector('[data-course-clear]').click()`);
        await until(
          () =>
            evaluate(
              `document.querySelectorAll('[data-course-card]').length===3`,
            ),
          "Clear restores catalog",
        );
        checks++;
        await go(`/courses/${course.slug}`);
        await until(
          () => evaluate(`!!document.querySelector('[data-demo-lesson]')`),
          "Public course outline",
        );
        assert.equal(
          await evaluate(`!!document.querySelector('[data-locked-lesson]')`),
          true,
          "Restricted lessons have an actionable control",
        );
        checks++;
        assert.equal(
          await evaluate(`document.body.innerHTML.includes('MainVid_001')`),
          false,
        );
        assert.equal(
          await evaluate(`!!document.querySelector('[data-youtube-player]')`),
          false,
        );
        checks += 2;
        const beforeLocked = requests.length;
        await evaluate(
          `document.querySelector('[data-locked-lesson="${lastId}"]').click()`,
        );
        await until(
          () =>
            evaluate(
              `document.activeElement===document.querySelector('[data-course-enrollment-panel]') && document.querySelector('[data-course-enrollment-panel]').textContent.includes('Selected advanced lesson')`,
            ),
          "Locked lesson prompt focuses and names chosen lesson",
        );
        assert.equal(
          requests
            .slice(beforeLocked)
            .some((request) => request.route.includes("playback")),
          false,
          "Locked selection makes no source request",
        );
        checks += 2;
        await evaluate(`document.querySelector('[data-demo-lesson]').click()`);
        await until(
          () => evaluate(`!!document.querySelector('[data-youtube-player]')`),
          "Public inline demo",
        );
        assert.equal(
          await evaluate(
            `document.querySelector('[data-youtube-player]').src.includes('DemoVid_001')`,
          ),
          true,
        );
        assert.equal(
          await evaluate(
            `document.querySelector('[data-youtube-player]').getBoundingClientRect().height>=200`,
          ),
          true,
        );
        assert.equal(
          await evaluate(`document.documentElement.scrollWidth>innerWidth`),
          false,
        );
        checks += 3;
        const publicShot = await call("Page.captureScreenshot", {
          format: "png",
          captureBeyondViewport: true,
        });
        await writeFile(
          path.join(temp, `course-public-${locale}-${width}.png`),
          Buffer.from(publicShot.data, "base64"),
        );
        await seed("LEARNER", locale);
        await go(`/account/courses/${id}/lessons/${mainId}`);
        await until(
          () => evaluate(`!!document.querySelector('[data-course-enroll]')`),
          "Explicit free enrollment",
        );
        assert.equal(
          await evaluate(`!!document.querySelector('[data-youtube-player]')`),
          false,
        );
        checks++;
        fixture.failEnrollment = true;
        await evaluate(
          `document.querySelector('[data-course-enroll]').click()`,
        );
        await until(
          () => evaluate(`!!document.querySelector('main [role="alert"]')`),
          "Lost enrollment acknowledgement",
        );
        const attempts = requests.filter((request) =>
          request.route.endsWith("/enrollment"),
        ).length;
        await evaluate(
          `document.querySelector('[data-course-enroll]').click();document.querySelector('[data-course-enroll]').click()`,
        );
        await until(
          () => evaluate(`!!document.querySelector('[data-youtube-player]')`),
          "Enrolled lesson playback",
        );
        assert.equal(
          requests.filter((request) => request.route.endsWith("/enrollment"))
            .length,
          attempts + 1,
          "Rapid enrollment clicks submit once",
        );
        checks++;
        assert.equal(memberships.size, 1);
        assert.equal(
          await evaluate(
            `document.querySelector('[data-youtube-player]').src.includes('MainVid_001')`,
          ),
          true,
        );
        checks += 2;
        const outlines = requests.filter(
          (request) => request.route === `me/courses/${id}`,
        ).length;
        const before = await evaluate("window.__destroyed");
        await evaluate(
          `document.querySelector('a[href="/account/courses/${id}/lessons/${demoId}"]').click()`,
        );
        await until(
          () =>
            evaluate(
              `document.querySelector('[data-youtube-player]')?.src.includes('DemoVid_001')`,
            ),
          "Lesson selection",
        );
        assert.ok((await evaluate("window.__destroyed")) > before);
        checks++;
        assert.equal(
          requests.filter((request) => request.route === `me/courses/${id}`)
            .length,
          outlines,
          "Lesson switch reuses course outline",
        );
        assert.equal(
          await evaluate(
            `document.querySelectorAll('[data-youtube-player]').length`,
          ),
          1,
          "Only selected player mounted",
        );
        assert.equal(
          await evaluate(
            `document.querySelector('[data-course-player]').getBoundingClientRect().width<=document.querySelector('[data-learning-main]').getBoundingClientRect().width && document.querySelector('[data-course-player] > div').getBoundingClientRect().width<=document.querySelector('[data-learning-main]').getBoundingClientRect().width`,
          ),
          true,
          "Minimum player height does not widen mobile frame",
        );
        checks++;
        assert.equal(
          await evaluate(
            `(()=>{const main=document.querySelector('[data-learning-main]').getBoundingClientRect(),side=document.querySelector('[data-course-curriculum]').getBoundingClientRect();return innerWidth>=1024 ? side.left>=main.right && Math.abs(side.top-main.top)<3 : side.top>=main.bottom;})()`,
          ),
          true,
          "Responsive player and curriculum arrangement",
        );
        assert.equal(
          await evaluate(`document.documentElement.scrollWidth>innerWidth`),
          false,
        );
        checks += 4;
        const shot = await call("Page.captureScreenshot", {
          format: "png",
          captureBeyondViewport: true,
        });
        await writeFile(
          path.join(temp, `course-watch-${locale}-${width}.png`),
          Buffer.from(shot.data, "base64"),
        );
        await go("/account/courses");
        await until(
          () =>
            evaluate(
              `!!document.querySelector('[data-course-library] a[href*="/lessons/"]')`,
            ),
          "Own enrolled library",
        );
        checks++;
        await seed("BUYER", locale);
        await go("/account/courses");
        await until(
          () => evaluate(`!!document.querySelector('[data-course-library]')`),
          "Other account library",
        );
        assert.equal(
          await evaluate(
            `!!document.querySelector('[data-course-library] a[href*="/lessons/"]')`,
          ),
          false,
        );
        checks++;
      }
    await seed("LEARNER", "en");
    await go(`/account/courses/${id}/lessons/${mainId}`);
    await until(
      () => evaluate(`!!document.querySelector('[data-youtube-player]')`),
      "Player error setup",
    );
    await evaluate(`sessionStorage.setItem('synthetic-player-mode','error')`);
    await go(`/account/courses/${id}/lessons/${mainId}`);
    await until(
      () =>
        evaluate(
          `!!document.querySelector('[data-course-player] [role="alert"]')`,
        ),
      "Unavailable video recovery",
    );
    checks++;
    await evaluate(
      `sessionStorage.removeItem('synthetic-player-mode');document.querySelector('[data-course-player] button').click()`,
    );
    await until(
      () =>
        evaluate(
          `!document.querySelector('[data-course-player] [role="alert"]')`,
        ),
      "Player retry",
    );
    checks++;
    await evaluate(`sessionStorage.setItem('synthetic-player-mode','hang')`);
    await go(`/account/courses/${id}/lessons/${mainId}`);
    await until(
      () =>
        evaluate(
          `!!document.querySelector('[data-course-player] [role="alert"]')`,
        ),
      "Bounded iframe readiness",
      20000,
    );
    checks++;
    await evaluate(`window.__players.at(-1).events.onReady()`);
    assert.equal(
      await evaluate(
        `!!document.querySelector('[data-course-player] [role="alert"]') && !document.querySelector('[data-youtube-player]')`,
      ),
      true,
      "Late ready cannot clear terminal timeout",
    );
    checks++;
    await evaluate(`sessionStorage.removeItem('synthetic-player-mode')`);
    memberships.clear();
    const registrationsBeforeLogin = requests.filter((request) =>
      request.route.endsWith("/enrollment"),
    ).length;
    await call("Network.deleteCookies", {
      name: "vetralink_access",
      url: origin,
    });
    await call("Network.deleteCookies", {
      name: "vetralink_refresh",
      url: origin,
    });
    await go(`/courses/${course.slug}`);
    await until(
      () =>
        evaluate(
          `!!document.querySelector('[data-course-enroll]:not([disabled])')`,
        ),
      "Sign-in enrollment entry",
    );
    await evaluate(
      `document.querySelector('[data-locked-lesson="${lastId}"]').click()`,
    );
    await until(
      () =>
        evaluate(
          `document.querySelector('[data-course-enrollment-panel]').textContent.includes('Selected advanced lesson')`,
        ),
      "Selected lesson prompt rendered before confirming",
    );
    await evaluate(`document.querySelector('[data-course-enroll]').click()`);
    await until(
      () =>
        evaluate(
          `!!document.querySelector('dialog[open] input[type="email"]')`,
        ),
      "Course auth dialog",
    );
    await set('dialog[open] input[type="email"]', "learner@example.test");
    await set('dialog[open] input[type="password"]', "DemoPassword123!");
    // Use the existing fixture learner email; no special authentication path.
    await evaluate(
      `document.querySelector('dialog[open] form').requestSubmit()`,
    );
    await until(
      () =>
        evaluate(
          `location.pathname==='/account/courses/${id}/lessons/${lastId}'`,
        ),
      "Validated selected lesson return after sign-in",
    );
    await until(
      () => evaluate(`!!document.querySelector('[data-course-enroll]')`),
      "Explicit enrollment after sign-in",
    );
    assert.equal(memberships.size, 0);
    assert.equal(
      requests.filter((request) => request.route.endsWith("/enrollment"))
        .length,
      registrationsBeforeLogin,
    );
    checks += 3;
    await evaluate(`document.querySelector('[data-course-enroll]').click()`);
    await until(
      () => evaluate(`!!document.querySelector('[data-youtube-player]')`),
      "Signed-in enrollment playback",
    );
    checks++;
    assert.equal(
      await evaluate(
        `document.querySelector('[data-youtube-player]').src.includes('LastVid_001')`,
      ),
      true,
      "Enrollment opens selected advanced lesson",
    );
    checks++;
    assert.equal(
      requests.some((request) => request.route === "farms"),
      false,
      "Learner shell does not fetch farms",
    );
    checks++;
    fixture.failCatalog = true;
    await go("/courses");
    await until(
      () => evaluate(`!!document.querySelector('main [role="alert"]')`),
      "Catalog API failure",
    );
    await evaluate(
      `document.querySelector('main [role="alert"]').parentElement.querySelector('button').click()`,
    );
    await until(
      () => evaluate(`!!document.querySelector('[data-course-card]')`),
      "Catalog retry",
    );
    checks += 2;
    await set("#course-search", "slow");
    await evaluate(`document.querySelector('main form').requestSubmit()`);
    await set("#course-search", "Synthetic");
    await evaluate(`document.querySelector('main form').requestSubmit()`);
    await until(
      () =>
        evaluate(`document.querySelectorAll('[data-course-card]').length===3`),
      "Newer search result wins",
    );
    await new Promise((resolve) => setTimeout(resolve, 600));
    assert.equal(
      await evaluate(`document.querySelectorAll('[data-course-card]').length`),
      3,
      "Late search response ignored",
    );
    checks++;
    fixture.failPlayback = true;
    await go(`/account/courses/${id}/lessons/${lastId}`);
    await until(
      () =>
        evaluate(
          `!!document.querySelector('[data-learning-main] [role="alert"]')`,
        ),
      "Playback API failure",
    );
    await evaluate(
      `document.querySelector('[data-learning-main] [role="alert"]').parentElement.querySelector('button').click()`,
    );
    await until(
      () => evaluate(`!!document.querySelector('[data-youtube-player]')`),
      "Playback API retry",
    );
    checks += 2;
    await call("Emulation.setDeviceMetricsOverride", {
      width: 320,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: true,
    });
    fixture.slowPlayback = true;
    await go(`/account/courses/${id}/lessons/${mainId}`);
    await until(
      () =>
        evaluate(
          `!!document.querySelector('[data-learning-main] [role="status"]')`,
        ),
      "Slow playback source shows reserved loading state",
    );
    assert.equal(
      await evaluate(
        `document.querySelector('[data-learning-main] > div').getBoundingClientRect().width<=document.querySelector('[data-learning-main]').getBoundingClientRect().width`,
      ),
      true,
      "Playback API loader stays within mobile main column",
    );
    checks++;
    await until(
      () => evaluate(`!!document.querySelector('[data-youtube-player]')`),
      "Delayed playback source resolves",
    );
    const playersBeforeLocale = await evaluate("window.__players.length");
    await evaluate(
      `document.querySelector('[data-locale-switcher] button[value="bn"]').click()`,
    );
    await until(
      () => evaluate(`document.documentElement.lang==='bn'`),
      "Learner language switch",
    );
    assert.equal(
      await evaluate("window.__players.length"),
      playersBeforeLocale,
      "Language switch does not recreate active video",
    );
    checks++;
    await evaluate(
      `document.querySelector('[data-locale-switcher] button[value="en"]').click()`,
    );
    await until(
      () => evaluate(`document.documentElement.lang==='en'`),
      "Restore English",
    );
    await evaluate(
      `document.querySelector('[data-course-curriculum] a[href$="${demoId}"]').click();document.querySelector('[data-course-curriculum] a[href$="${mainId}"]').click()`,
    );
    await until(
      () =>
        evaluate(
          `location.pathname.endsWith('${mainId}') && document.querySelector('[data-youtube-player]')?.src.includes('MainVid_001')`,
        ),
      "Rapid selection settles on latest lesson",
    );
    assert.equal(
      await evaluate(
        `document.querySelectorAll('[data-youtube-player]').length`,
      ),
      1,
    );
    checks++;
    assert.equal(
      requests.some(
        (request) => request.route.includes("me/courses") && request.farmId,
      ),
      false,
    );
    checks++;
    sessionUnavailable = true;
    await evaluate(
      `window.dispatchEvent(new Event('vetralink-session-updated'))`,
    );
    await until(
      () => evaluate(`!!document.querySelector('main [role="alert"]')`),
      "Session revalidation failure is visible",
    );
    assert.equal(
      await evaluate(`!!document.querySelector('[data-youtube-player]')`),
      false,
      "Private player stops while session is uncertain",
    );
    checks++;
    sessionUnavailable = false;
    await evaluate(
      `window.dispatchEvent(new Event('vetralink-session-updated'))`,
    );
    await until(
      () => evaluate(`!!document.querySelector('[data-youtube-player]')`),
      "Confirmed session restores current lesson",
    );
    checks++;
    previousLearner = replaceLearner({
      id: "550e8400-e29b-41d4-a716-446655440099",
      name: "Other learner identity",
      roleVersion: 1,
    });
    await evaluate(
      `window.dispatchEvent(new Event('vetralink-session-updated'))`,
    );
    await until(
      () =>
        evaluate(
          `!!document.querySelector('[data-course-enroll]') && document.querySelector('[data-course-enrollment]').textContent.includes('Other learner identity')`,
        ),
      "Same-role account change discards prior enrollment",
    );
    assert.equal(
      await evaluate(`!!document.querySelector('[data-youtube-player]')`),
      false,
      "Another learner cannot retain prior player",
    );
    checks++;
    replaceLearner(previousLearner);
    previousLearner = undefined;
    await evaluate(
      `window.dispatchEvent(new Event('vetralink-session-updated'))`,
    );
    await until(
      () => evaluate(`!!document.querySelector('[data-youtube-player]')`),
      "Original learner enrollment restored",
    );
    checks++;
  } finally {
    if (previousLearner) replaceLearner(previousLearner);
    sessionUnavailable = false;
    unsubscribe();
    await call("Fetch.disable");
    await call("Page.removeScriptToEvaluateOnNewDocument", {
      identifier: script.identifier,
    });
    await call("Network.setBlockedURLs", { urls: [] });
    memberships.clear();
    fixture.published = true;
  }
  console.log(
    `Passed ${checks} learner course browser checks. Screenshots: ${temp}`,
  );
  return checks;
}
