import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const origin =
  process.argv.find((arg) => arg.startsWith("http")) ?? "http://localhost:3100";
assert.ok(
  ["localhost", "127.0.0.1", "[::1]"].includes(new URL(origin).hostname),
);
const mode = process.argv.find((arg) => arg.startsWith("--probe-"));
const profile = await mkdtemp(
  path.join(os.tmpdir(), "public-navigation-chrome-"),
);
const screenshotDir = path.join(profile, "screenshots");
await mkdir(screenshotDir);
const chrome = spawn(
  process.env.CHROME_PATH ??
    (process.platform === "win32"
      ? "C:/Program Files/Google/Chrome/Application/chrome.exe"
      : "/usr/bin/google-chrome"),
  [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--remote-debugging-port=9335",
    `--user-data-dir=${profile}`,
    "about:blank",
  ],
  { stdio: "ignore" },
);
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let socket;
let checks = 0;
try {
  let pages;
  for (let i = 0; i < 100; i++) {
    try {
      pages = await (await fetch("http://127.0.0.1:9335/json/list")).json();
      break;
    } catch {
      await delay(100);
    }
  }
  assert.ok(pages, "Chrome starts");
  socket = new WebSocket(
    pages.find((p) => p.type === "page").webSocketDebuggerUrl,
  );
  await new Promise((resolve) =>
    socket.addEventListener("open", resolve, { once: true }),
  );
  const pending = new Map();
  let id = 0;
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    const waiter = pending.get(message.id);
    if (waiter) {
      pending.delete(message.id);
      waiter(message);
    }
  });
  const cdp = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const key = ++id;
      const timer = setTimeout(() => {
        pending.delete(key);
        reject(new Error(`CDP timeout: ${method}`));
      }, 15000);
      pending.set(key, (m) => {
        clearTimeout(timer);
        m.error
          ? reject(new Error(JSON.stringify(m.error)))
          : resolve(m.result);
      });
      socket.send(JSON.stringify({ id: key, method, params }));
    });
  const evaluate = async (expression) => {
    const result = await cdp("Runtime.evaluate", {
      expression,
      returnByValue: true,
    });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };
  async function until(fn, message) {
    for (let i = 0; i < 100; i++) {
      try {
        if (await fn()) return;
      } catch {}
      await delay(100);
    }
    throw new Error(message);
  }
  async function key(key, code, virtual, modifiers = 0) {
    await cdp("Input.dispatchKeyEvent", {
      type: "keyDown",
      ...(key === "Enter" ? { text: "\r", unmodifiedText: "\r" } : {}),
      key,
      code,
      windowsVirtualKeyCode: virtual,
      modifiers,
    });
    await cdp("Input.dispatchKeyEvent", {
      type: "keyUp",
      key,
      code,
      windowsVirtualKeyCode: virtual,
      modifiers,
    });
  }
  await cdp("Page.enable");
  await cdp("Network.enable");
  let locale = "bn";
  async function setLocale(value) {
    locale = value;
    await cdp("Network.setCookie", {
      name: "vetralink-locale",
      value,
      url: origin,
      path: "/",
    });
  }
  async function width(value, deviceScaleFactor = 1) {
    await cdp("Emulation.setDeviceMetricsOverride", {
      width: value,
      height: 1000,
      deviceScaleFactor,
      mobile: false,
    });
  }
  async function go(route) {
    await cdp("Page.navigate", { url: origin + route });
    await until(
      async () =>
        await evaluate(
          `document.readyState==='complete' && location.pathname+location.search+location.hash===${JSON.stringify(route)} && document.documentElement.lang===${JSON.stringify(locale)} && !!document.querySelector('main h1')`,
        ),
      `Page loaded: ${route}`,
    );
  }
  async function hydrated() {
    await until(
      () =>
        evaluate(
          `!!document.querySelector('[data-auth-trigger]:not(:disabled)')`,
        ),
      "Header hydration finished",
    );
  }
  async function resetCheck() {
    await setLocale("en");
    await width(1440);
    await go("/blog");
    await hydrated();
    await evaluate(
      `(() => {document.querySelector('#public-search').value='unsent keyword';document.querySelector('#public-filter').value='planning';document.querySelector('form[action="/blog"] a').click();})()`,
    );
    await delay(700);
    assert.equal(
      await evaluate(`document.querySelector('#public-search').value`),
      "",
      "Clear filters resets unsent search",
    );
    assert.equal(
      await evaluate(`document.querySelector('#public-filter').value`),
      "",
      "Clear filters resets unsent topic",
    );
    checks++;
    await go("/doctors?specialty=dairy");
    await hydrated();
    await evaluate(
      `document.querySelector('form[action="/doctors"] a').click()`,
    );
    await until(
      () =>
        evaluate(
          `location.search==='' && document.querySelectorAll('[data-doctor-card]').length===2`,
        ),
      "Doctor reset returns all profiles",
    );
    assert.equal(
      await evaluate(`document.querySelector('#public-filter').value`),
      "",
    );
    checks++;
    await go("/blog?topic=records");
    await hydrated();
    await evaluate(
      `document.querySelector('.desktop-nav a[href="/blog"]').click()`,
    );
    await until(
      () =>
        evaluate(
          `location.pathname==='/blog' && location.search==='' && document.querySelectorAll('[data-blog-card]').length===3`,
        ),
      "Header Blog clears topic URL",
    );
    assert.equal(
      await evaluate(`document.querySelector('#public-filter').value`),
      "",
      "Client navigation resets the selected topic",
    );
    checks++;
  }
  async function escapeCheck() {
    await setLocale("en");
    await width(768);
    await go("/about");
    await hydrated();
    await evaluate(`document.querySelector('.menu-toggle').click()`);
    await until(
      () =>
        evaluate(
          `document.querySelector('.menu-toggle').getAttribute('aria-expanded')==='true'`,
        ),
      "Mobile menu opens",
    );
    await evaluate(`document.querySelector('.menu-toggle').focus()`);
    await key("Tab", "Tab", 9, 8);
    await key("Escape", "Escape", 27);
    assert.equal(
      await evaluate(
        `document.querySelector('.menu-toggle').getAttribute('aria-expanded')`,
      ),
      "false",
      "Mobile menu dismisses after focus leaves",
    );
    checks++;
  }
  if (mode === "--probe-reset") {
    await resetCheck();
    console.log("Reset regression passed");
  } else if (mode === "--probe-escape") {
    await escapeCheck();
    console.log("Escape regression passed");
  } else {
    const routes = [
      "/",
      "/about",
      "/learning",
      "/help",
      "/blog",
      "/blog/one-place-for-farm-notes",
      "/doctors",
      "/doctors/demo-rafiq-hasan",
    ];
    for (const selected of ["bn", "en"]) {
      await setLocale(selected);
      for (const size of [360, 768, 1024, 1280, 1440]) {
        await width(size);
        for (const route of routes) {
          await go(route);
          const state = await evaluate(
            `({overflow:document.documentElement.scrollWidth>innerWidth,h1:document.querySelectorAll('h1').length,title:document.title,main:document.querySelectorAll('main').length})`,
          );
          assert.equal(
            state.overflow,
            false,
            `${selected} ${size} ${route}: page overflow`,
          );
          assert.equal(state.h1, 1);
          assert.equal(state.main, 1);
          assert.ok(
            state.title.includes(
              selected === "bn" ? "খামার স্কুল" : "Khamar School",
            ),
          );
          const activeRoute = route.startsWith("/blog")
            ? "/blog"
            : route.startsWith("/doctors")
              ? "/doctors"
              : route;
          const activeNames = {
            "/about": selected === "bn" ? "আমাদের সম্পর্কে" : "About us",
            "/help": selected === "bn" ? "সহায়তা" : "Help",
            "/learning": selected === "bn" ? "শিক্ষা" : "Learning",
            "/blog": selected === "bn" ? "ব্লগ" : "Blog",
            "/doctors": selected === "bn" ? "পশুচিকিৎসা" : "Veterinary care",
          };
          if (route !== "/") {
            const scope = size >= 1280 ? ".desktop-nav" : "#mobile-menu";
            await until(
              () =>
                evaluate(
                  `Array.from(document.querySelectorAll('${scope} [data-active]')).some(el => el.textContent.trim()===${JSON.stringify(activeNames[activeRoute])})`,
                ),
              `${selected} ${route}: current navigation highlighted`,
            );
            const activeStyle = await evaluate(
              `(() => { const el = Array.from(document.querySelectorAll('${scope} [data-active]')).find(el => el.textContent.trim()===${JSON.stringify(activeNames[activeRoute])}); const style = getComputedStyle(el); return { color: style.color, background: style.backgroundColor, decoration: style.textDecorationLine }; })()`,
            );
            assert.equal(
              activeStyle.color,
              "rgb(162, 105, 19)",
              "Current nav has dark amber text",
            );
            assert.equal(
              activeStyle.background,
              "rgba(0, 0, 0, 0)",
              "Current nav has no active background",
            );
            assert.equal(
              activeStyle.decoration,
              "none",
              "Current nav uses only text color",
            );
          }
          checks++;
          if (route === "/doctors" && [360, 1440].includes(size)) {
            const capture = await cdp("Page.captureScreenshot", {
              format: "png",
              captureBeyondViewport: false,
            });
            await writeFile(
              path.join(screenshotDir, `doctors-${selected}-${size}.png`),
              Buffer.from(capture.data, "base64"),
            );
          }
        }
      }
      await width(1440);
      await go("/#farm-demo");
      await hydrated();
      for (const [scrollY, color] of [
        [0, "rgb(234, 196, 116)"],
        [100, "rgb(162, 105, 19)"],
      ]) {
        await evaluate(`window.scrollTo(0, ${scrollY})`);
        await until(
          () =>
            evaluate(
              `document.querySelector('.site-header').classList.contains('is-scrolled') === ${scrollY > 16} && !!document.querySelector('.desktop-nav button[data-active]')`,
            ),
          "Homepage active group follows header surface",
        );
        const activeStyle = await evaluate(
          `(() => { const style = getComputedStyle(document.querySelector('.desktop-nav button[data-active]')); return {color: style.color, background: style.backgroundColor}; })()`,
        );
        assert.equal(
          activeStyle.color,
          color,
          "Active text remains visible on the homepage header",
        );
        assert.equal(
          activeStyle.background,
          "rgba(0, 0, 0, 0)",
          "Homepage active group has no active background",
        );
        checks++;
      }
      await go("/about");
      await hydrated();
      await evaluate(
        `document.querySelector('.desktop-nav a[href="/learning#courses"]').click()`,
      );
      await until(
        () =>
          evaluate(
            `location.pathname==='/learning' && location.hash==='#courses' && !!document.querySelector('section#courses')`,
          ),
        "Courses link reaches the learning section",
      );
      await until(
        () =>
          evaluate(
            `document.querySelector('.desktop-nav a[href="/learning#courses"]').hasAttribute('data-active')`,
          ),
        "Courses is highlighted",
      );
      assert.equal(
        await evaluate(
          `document.querySelector('.desktop-nav button[aria-current]')===null`,
        ),
        true,
      );
      await evaluate(
        `document.querySelector('footer a[href="/learning#guides"]').click()`,
      );
      await until(
        () =>
          evaluate(
            `location.hash==='#guides' && document.querySelector('.desktop-nav a[href="/learning#courses"]').getAttribute('data-active')===null && !!document.querySelector('.desktop-nav button[aria-current]')`,
          ),
        "Same-page guides highlight Learning",
      );
      await evaluate(`history.back()`);
      await until(
        () =>
          evaluate(
            `location.hash==='#courses' && document.querySelector('.desktop-nav a[href="/learning#courses"]').hasAttribute('data-active')`,
          ),
        "Back restores Courses active color",
      );
      checks += 3;
      await go("/about");
      await hydrated();
      await evaluate(`document.querySelector('.desktop-nav button').focus()`);
      await key("Enter", "Enter", 13);
      await until(
        () =>
          evaluate(
            `document.querySelector('.desktop-nav button').getAttribute('aria-expanded')==='true'`,
          ),
        "Desktop submenu opens by keyboard",
      );
      await key("Escape", "Escape", 27);
      await until(
        () =>
          evaluate(
            `document.querySelector('.desktop-nav button').getAttribute('aria-expanded')==='false'`,
          ),
        "Desktop Escape closes",
      );
      assert.equal(
        await evaluate(
          `document.activeElement===document.querySelector('.desktop-nav button')`,
        ),
        true,
      );
      checks++;
      await evaluate(`document.querySelector('.desktop-nav button').click()`);
      await until(
        () =>
          evaluate(
            `document.querySelector('.desktop-nav button').getAttribute('aria-expanded')==='true'`,
          ),
        "Desktop submenu reopens",
      );
      await cdp("Input.dispatchMouseEvent", {
        type: "mousePressed",
        x: 20,
        y: 500,
        button: "left",
        clickCount: 1,
      });
      await cdp("Input.dispatchMouseEvent", {
        type: "mouseReleased",
        x: 20,
        y: 500,
        button: "left",
        clickCount: 1,
      });
      await until(
        () =>
          evaluate(
            `document.querySelector('.desktop-nav button').getAttribute('aria-expanded')==='false'`,
          ),
        "Outside click closes desktop submenu",
      );
      checks++;
      await width(768);
      await go("/about");
      await hydrated();
      await evaluate(
        `document.querySelector('.desktop-nav a[href="/learning#courses"]').click()`,
      );
      await until(
        () =>
          evaluate(
            `location.pathname==='/learning' && location.hash==='#courses' && !!document.querySelector('section#courses')`,
          ),
        "Courses link reaches the learning section",
      );
      checks++;
      await go("/about");
      await hydrated();
      await evaluate(`document.querySelector('.menu-toggle').click()`);
      await until(
        () => evaluate(`document.querySelector('#mobile-menu').hidden===false`),
        "Mobile menu opens",
      );
      assert.ok(
        await evaluate(
          `document.querySelector('#mobile-menu a[href="/doctors"]')!==null`,
        ),
      );
      await key("Escape", "Escape", 27);
      await until(
        () => evaluate(`document.querySelector('#mobile-menu').hidden`),
        "Mobile Escape closes",
      );
      assert.equal(
        await evaluate(
          `document.activeElement===document.querySelector('.menu-toggle')`,
        ),
        true,
      );
      checks++;
      await evaluate(`document.querySelector('.menu-toggle').click()`);
      await width(1440);
      await until(
        () => evaluate(`document.querySelector('#mobile-menu').hidden`),
        "Resize closes mobile disclosure",
      );
      checks++;
      await go("/help");
      // 1440 physical pixels at 200% scale produce a 720 CSS-pixel layout.
      await width(720, 2);
      assert.equal(
        await evaluate(`document.documentElement.scrollWidth>innerWidth`),
        false,
        "200% viewport-equivalent reflow stays within viewport",
      );
      checks++;
    }
    await resetCheck();
    await escapeCheck();
    await setLocale("bn");
    await cdp("Emulation.setScriptExecutionDisabled", { value: true });
    await width(360);
    await go("/about");
    assert.ok(
      await evaluate(
        `Array.from(document.querySelectorAll('noscript a')).some(a=>a.getAttribute('href')==='/doctors')`,
      ),
      "No-JavaScript public links",
    );
    assert.equal(
      await evaluate(`document.documentElement.scrollWidth>innerWidth`),
      false,
    );
    checks++;
    await cdp("Emulation.setScriptExecutionDisabled", { value: false });
    console.log(
      `Passed: ${checks} bilingual responsive, keyboard, dismissal, reset, scaled reflow and no-JavaScript browser checks. Screenshots: ${screenshotDir}`,
    );
  }
} finally {
  socket?.close();
  chrome.kill();
}
