import { randomUUID } from "node:crypto";
// Local production-browser acceptance with synthetic users and a controlled upstream.
// Requires Node 22+ WebSocket and local Chrome; never targets a deployed API/database.
import assert from "node:assert/strict";
import http from "node:http";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const webDir = fileURLToPath(new URL("../", import.meta.url));
const tempRoot = await mkdtemp(path.join(tmpdir(), "vetralink-auth-qa-"));
const origin = "http://localhost:3210";
const users = new Map();
const sessions = new Map();
const operations = [];
let count = 0;
let offline = false;
let refreshCount = 0;
const summary = (email, role, name) => ({
  id: randomUUID(),
  email,
  role,
  name,
  status: "ACTIVE",
  isEmailVerified: false,
  maskedPhone: null,
  avatarUrl: null,
  createdAt: "2026-10-07T00:00:00Z",
});
function issue(user) {
  const tokens = {
    accessToken: `synthetic-access-${++count}`,
    refreshToken: `synthetic-refresh-${count}`,
    tokenType: "Bearer",
    expiresIn: 900,
  };
  sessions.set(tokens.refreshToken, {
    user,
    access: tokens.accessToken,
    revoked: false,
    expired: false,
  });
  return tokens;
}
const upstream = http.createServer(async (req, res) => {
  let text = "";
  for await (const chunk of req) text += chunk;
  const data = text ? JSON.parse(text) : {};
  const action = req.url.split("/").at(-1);
  operations.push({
    action,
    keys: Object.keys(data),
    role: data.role,
    phone: data.phone,
  });
  const send = (status, value, message = "") => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: status < 400, data: value, message }));
  };
  if (offline) return send(503, null);
  if (action === "register") {
    if (users.has(data.email))
      return send(409, null, "Email already registered");
    if (data.phone === "+8801700000000")
      return send(409, null, "Phone already registered");
    const user = summary(data.email, data.role ?? "LEARNER", data.name);
    users.set(data.email, { user, password: data.password });
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return send(201, { user, tokens: issue(user) });
  }
  if (action === "login") {
    if (data.email === "suspended@example.test") return send(403, null);
    const record = users.get(data.email);
    if (!record || record.password !== data.password) return send(401, null);
    return send(200, { user: record.user, tokens: issue(record.user) });
  }
  if (action === "me") {
    const access = req.headers.authorization?.slice(7);
    const session = [...sessions.values()].find(
      (item) => item.access === access && !item.expired,
    );
    return session ? send(200, session.user) : send(401, null);
  }
  const session = sessions.get(data.refreshToken);
  if (action === "refresh") {
    refreshCount++;
    if (!session || session.revoked) return send(401, null);
    session.revoked = true;
    return send(200, { tokens: issue(session.user) });
  }
  if (action === "logout") {
    if (session) session.revoked = true;
    return send(200, null);
  }
  send(404, null);
});
await new Promise((resolve, reject) =>
  upstream.once("error", reject).listen(3211, "127.0.0.1", resolve),
);

let nextProcess;
let chrome;
const clients = [];
async function until(task, message, timeout = 15000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    try {
      if (await task()) return;
    } catch {
      /* service/UI startup */
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(message);
}
async function connect(target) {
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  let sequence = 0;
  const pending = new Map();
  const exceptions = [];
  ws.onclose = () => {
    for (const request of pending.values())
      request.reject(new Error("CDP connection closed"));
    pending.clear();
  };
  ws.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.method === "Runtime.exceptionThrown")
      exceptions.push(
        message.params.exceptionDetails.exception?.description ??
          message.params.exceptionDetails.text,
      );
    if (!message.id) return;
    const request = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) request?.reject(new Error(message.error.message));
    else request?.resolve(message.result);
  };
  const call = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++sequence;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  const evaluate = async (expression) => {
    const result = await call("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails)
      throw new Error(
        result.exceptionDetails.exception?.description ??
          "Browser evaluation failed",
      );
    return result.result.value;
  };
  const client = { ws, call, evaluate, exceptions };
  clients.push(client);
  await call("Runtime.enable");
  await call("Page.enable");
  return client;
}
async function navigate(client, route = "/learning") {
  await client.call("Page.navigate", { url: `${origin}${route}` });
  try {
    await until(
      () =>
        client.evaluate(
          "document.readyState === 'complete' && [...document.querySelectorAll('header [data-auth-trigger], header [data-avatar-trigger]')].some(b => !b.disabled)",
        ),
      "Session/header did not become ready",
    );
  } catch (error) {
    const state = await client.evaluate(
      "({ path: location.pathname, ready: document.readyState, triggers: [...document.querySelectorAll('header [data-auth-trigger]')].map(b=>({disabled:b.disabled})), locks: !!navigator.locks })",
    );
    throw new Error(
      `${error.message}: ${JSON.stringify(state)} ${JSON.stringify(client.exceptions)}`,
    );
  }
}
async function openDialog(client, mode, width) {
  await client.call("Page.bringToFront");
  await until(
    () =>
      client.evaluate(
        "[...document.querySelectorAll('header [data-auth-trigger], header [data-avatar-trigger]')].some(b=>!b.disabled)",
      ),
    "Auth control stayed busy",
  );
  await client.evaluate(
    width < 1280 ? "document.querySelector('.menu-toggle').click()" : "void 0",
  );
  await client.evaluate(
    `(() => { const buttons = [...document.querySelectorAll('header button')].filter(b => b.getClientRects().length); const button = buttons.find(b => ${mode === "register" ? "b.textContent.trim() === (document.documentElement.lang === 'bn' ? 'সাইন আপ' : 'Sign up')" : "b.hasAttribute('data-auth-trigger') || b.hasAttribute('data-avatar-trigger')"}); if (!button) throw new Error('Auth trigger missing'); button.focus(); button.click(); })()`,
  );
  await until(
    () =>
      client.evaluate(
        "!!document.querySelector('dialog[open], [data-public-account-panel]')",
      ),
    "Dialog did not open",
  );
}
async function fill(client, values) {
  await client.evaluate(
    `(() => { const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; for (const [field,value] of Object.entries(${JSON.stringify(values)})) { const input = document.querySelector('#auth-' + field); setter.call(input,value); input.dispatchEvent(new Event('input',{bubbles:true})); } })()`,
  );
}
const submit = (client) =>
  client.evaluate("document.querySelector('dialog form').requestSubmit()");
async function signedIn(client) {
  // Explicit auth now closes the modal and lands on the common workspace.
  await until(
    () =>
      client.evaluate(
        "location.pathname === '/dashboard' && !!document.querySelector('[data-dashboard-role]')",
      ),
    "Explicit login did not reach dashboard",
  );
  await navigate(client);
  await client.evaluate(
    "document.querySelector('[data-avatar-trigger]').focus();document.querySelector('[data-avatar-trigger]').click()",
  );
  try {
    await until(
      () =>
        client.evaluate(
          "!!document.querySelector('[data-public-account-panel]')",
        ),
      "Public avatar menu did not appear",
    );
  } catch (error) {
    const state = await client.evaluate(
      "({ alert: document.querySelector('dialog [role=alert]')?.textContent, pending: document.querySelector('dialog form')?.getAttribute('aria-busy') })",
    );
    throw new Error(`${error.message}: ${JSON.stringify(state)}`);
  }
}
async function dismiss(client) {
  await client.call("Page.bringToFront");
  if (
    await client.evaluate(
      "!!document.querySelector('[data-public-account-panel]')",
    )
  ) {
    // Exercise the disclosure handler deterministically; CDP occasionally drops
    // this key after navigation. Native dialog Escape is exercised below.
    await client.evaluate(
      "document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',bubbles:true,cancelable:true}))",
    );
  } else {
    for (const type of ["keyDown", "keyUp"])
      await client.call("Input.dispatchKeyEvent", {
        type,
        key: "Escape",
        code: "Escape",
        windowsVirtualKeyCode: 27,
      });
  }
  await until(
    () =>
      client.evaluate(
        "!document.querySelector('dialog[open], [data-public-account-panel]')",
      ),
    "Escape did not dismiss dialog",
  );
}
async function chooseRole(client, role) {
  await client.evaluate(
    `(() => { const select = document.querySelector('#auth-role'); const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; setter.call(select, ${JSON.stringify(role)}); select.dispatchEvent(new Event('change', { bubbles: true })); })()`,
  );
}

async function choosePhoneCountry(client, country) {
  await client.evaluate(
    `(() => { const select = document.querySelector('#auth-phone-country'); const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; setter.call(select, ${JSON.stringify(country)}); select.dispatchEvent(new Event('change', { bubbles: true })); })()`,
  );
}

try {
  nextProcess = spawn(
    process.execPath,
    [
      require.resolve("next/dist/bin/next"),
      "start",
      ...(process.env.WEB_TEST_BUILD_DIR
        ? [process.env.WEB_TEST_BUILD_DIR]
        : []),
      "-p",
      "3210",
    ],
    {
      cwd: webDir,
      windowsHide: true,
      stdio: "ignore",
      env: {
        ...process.env,
        NODE_ENV: "production",
        API_BASE_URL: "http://127.0.0.1:3211/api/v1",
      },
    },
  );
  await until(
    async () => (await fetch(origin)).ok,
    "Production web server did not start",
    30000,
  );
  chrome = spawn(
    process.env.CHROME_PATH ||
      (process.platform === "win32"
        ? "C:/Program Files/Google/Chrome/Application/chrome.exe"
        : "/usr/bin/google-chrome"),
    [
      "--headless=new",
      ...(process.env.CHROME_NO_SANDBOX === "1" ? ["--no-sandbox"] : []),
      "--remote-debugging-port=9333",
      `--user-data-dir=${path.join(tempRoot, "profile")}`,
      "--no-first-run",
      "--no-default-browser-check",
      "about:blank",
    ],
    { windowsHide: true, stdio: "ignore" },
  );
  await until(
    async () => (await fetch("http://127.0.0.1:9333/json/version")).ok,
    "Chrome CDP did not start",
  );
  const targets = await (await fetch("http://127.0.0.1:9333/json/list")).json();
  const target =
    targets.find(
      (entry) => entry.type === "page" && entry.url === "about:blank",
    ) ?? targets.find((entry) => entry.type === "page");
  assert.ok(target, "Chrome page target is required");
  const client = await connect(target);
  const screenshots = [];
  for (const locale of ["bn", "en"]) {
    await client.call("Network.clearBrowserCookies");
    await client.call("Network.setCookie", {
      name: "vetralink-locale",
      value: locale,
      url: origin,
    });
    for (const width of [1440, 768, 375, 320]) {
      await client.call("Emulation.setDeviceMetricsOverride", {
        width,
        height: 900,
        deviceScaleFactor: 1,
        mobile: width < 1280,
      });
      await navigate(client);
      assert.equal(
        await client.evaluate("document.documentElement.lang"),
        locale,
      );
      await openDialog(client, "login", width);
      assert.equal(
        await client.evaluate("document.activeElement.id"),
        "auth-email",
      );
      assert.equal(
        await client.evaluate("getComputedStyle(document.body).overflow"),
        "hidden",
      );
      assert.ok(
        await client.evaluate(
          "document.documentElement.scrollWidth <= innerWidth && document.querySelector('dialog').scrollWidth <= document.querySelector('dialog').clientWidth",
        ),
      );
      await submit(client);
      assert.equal(
        await client.evaluate(
          "document.querySelectorAll('[aria-invalid=true]').length",
        ),
        2,
      );
      assert.equal(
        await client.evaluate("document.activeElement.id"),
        "auth-email",
      );
      // Native Tab focus stays inside the modal even after cycling all controls.
      for (let n = 0; n < 10; n++) {
        await client.call("Input.dispatchKeyEvent", {
          type: "keyDown",
          key: "Tab",
          code: "Tab",
          windowsVirtualKeyCode: 9,
        });
        assert.equal(
          await client.evaluate(
            "document.activeElement === document.body || !!document.activeElement.closest('dialog')",
          ),
          true,
        );
      }
      await client.evaluate(
        "[...document.querySelectorAll('dialog button')].at(-1).click()",
      );
      assert.ok(
        await client.evaluate("!!document.querySelector('#auth-confirmation')"),
      );
      await fill(client, {
        name: " ",
        email: "bad",
        password: "short",
        confirmation: "mismatch",
      });
      await submit(client);
      assert.equal(
        await client.evaluate(
          "document.querySelectorAll('[aria-invalid=true]').length",
        ),
        4,
      );
      assert.equal(
        await client.evaluate(
          "document.querySelectorAll('dialog select[name=role] option').length",
        ),
        4,
      );
      assert.equal(
        await client.evaluate(
          "document.querySelector('#auth-phone-country').value",
        ),
        "BD",
      );
      assert.ok(
        await client.evaluate(
          "document.querySelector('#auth-phone-hint').textContent.includes(document.documentElement.lang==='bn' ? 'বাংলাদেশ' : 'Bangladesh')",
        ),
      );
      await fill(client, { phone: "01712" });
      await client.evaluate(
        "document.querySelector('#auth-phone').focus(); document.querySelector('#auth-role').focus()",
      );
      await until(
        () =>
          client.evaluate(
            "document.querySelector('#auth-phone').getAttribute('aria-invalid')==='true' && !!document.querySelector('#auth-phone-error')",
          ),
        "Incomplete phone feedback missing",
      );
      await fill(client, { phone: "০১৭১২৩৪৫৬৭৮" });
      await until(
        () => client.evaluate("!document.querySelector('#auth-phone-error')"),
        "Valid Bangla number remains invalid",
      );
      await choosePhoneCountry(client, "US");
      await fill(client, { phone: "2025550123" });
      await until(
        () => client.evaluate("!document.querySelector('#auth-phone-error')"),
        "Valid US local phone rejected",
      );
      await fill(client, { phone: "+14165550123" });
      await until(
        () =>
          client.evaluate(
            "document.querySelector('#auth-phone-country').value==='CA' && !document.querySelector('#auth-phone-error')",
          ),
        "International paste did not select Canada",
      );
      await choosePhoneCountry(client, "BD");
      await until(
        () => client.evaluate("!!document.querySelector('#auth-phone-error')"),
        "Explicit country mismatch not rejected",
      );
      await fill(client, { phone: "" });
      await until(
        () => client.evaluate("!document.querySelector('#auth-phone-error')"),
        "Optional empty phone rejected",
      );
      const learnerDescription = await client.evaluate(
        "document.querySelector('#auth-role-description').textContent",
      );
      assert.ok(
        learnerDescription.includes(locale === "bn" ? "আবেদন" : "apply"),
      );
      assert.equal(
        await client.evaluate(
          "document.querySelector('#auth-role').getAttribute('aria-describedby')",
        ),
        "auth-role-description",
      );
      await client.evaluate("document.querySelector('#auth-role').focus()");
      await client.call("Input.dispatchKeyEvent", {
        type: "keyDown",
        key: "ArrowDown",
        code: "ArrowDown",
        windowsVirtualKeyCode: 40,
      });
      await client.call("Input.dispatchKeyEvent", {
        type: "keyUp",
        key: "ArrowDown",
        code: "ArrowDown",
        windowsVirtualKeyCode: 40,
      });
      await until(
        () =>
          client.evaluate(
            "document.querySelector('#auth-role').value==='FARMER'",
          ),
        "Keyboard role selection failed",
      );
      await until(
        () =>
          client.evaluate(
            "document.querySelector('#auth-role-description').textContent.includes(document.documentElement.lang==='bn' ? 'খামারের তথ্য' : 'Farm setup')",
          ),
        "Selected role explanation did not update",
      );
      for (const role of ["VET", "BUYER", "LEARNER"]) {
        await chooseRole(client, role);
        assert.notEqual(
          await client.evaluate(
            "document.querySelector('#auth-role-description').textContent.trim()",
          ),
          "",
        );
      }
      assert.equal(
        await client.evaluate(
          "getComputedStyle(document.querySelector('#auth-register-fields')).gridTemplateColumns.split(' ').length",
        ),
        width >= 640 ? 2 : 1,
      );
      assert.ok(
        await client.evaluate(
          "document.querySelector('dialog').scrollWidth <= document.querySelector('dialog').clientWidth",
        ),
      );
      if (width === 1440 || width === 320) {
        const shot = await client.call("Page.captureScreenshot");
        const location = path.join(tempRoot, `${locale}-${width}-signup.png`);
        await writeFile(location, Buffer.from(shot.data, "base64"));
        screenshots.push(location);
      }
      await dismiss(client);
      assert.equal(
        await client.evaluate("getComputedStyle(document.body).overflow"),
        "visible",
      );
      assert.equal(
        await client.evaluate(
          width < 1280
            ? "document.activeElement.classList.contains('menu-toggle')"
            : "document.activeElement.hasAttribute('data-auth-trigger')",
        ),
        true,
      );
    }
    console.log(
      `${locale}: desktop/tablet/375px/320px validation, modal focus, Escape and overflow passed`,
    );
  }

  await client.call("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await navigate(client);
  await openDialog(client, "register", 1440);
  await fill(client, {
    name: "Test Veterinarian",
    email: "vet@example.test",
    password: "long password",
    confirmation: "long password",
    phone: "01712",
  });
  await submit(client);
  assert.equal(
    operations.filter((op) => op.action === "register").length,
    0,
    "Invalid phone must not reach upstream",
  );
  assert.equal(
    await client.evaluate("document.activeElement.id"),
    "auth-phone",
  );
  await fill(client, { phone: "০১৮০০০০০০০০" });
  await chooseRole(client, "VET");
  await submit(client);
  await until(
    () => operations.some((operation) => operation.action === "register"),
    "Signup request did not reach upstream",
  );
  assert.ok(
    await client.evaluate(
      "document.querySelector('dialog button[type=submit]').disabled",
    ),
  );
  await client.call("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Escape",
    windowsVirtualKeyCode: 27,
  });
  await client.call("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "Escape",
    windowsVirtualKeyCode: 27,
  });
  const pendingCancelState = await client.evaluate(
    "({ exists: !!document.querySelector('dialog'), open: document.querySelector('dialog')?.open, pending: document.querySelector('dialog form')?.getAttribute('aria-busy'), account: !!document.querySelector('[data-public-account-panel]') })",
  );
  assert.equal(
    pendingCancelState.open,
    true,
    `Pending cancel state: ${JSON.stringify(pendingCancelState)}`,
  );
  assert.equal(
    await client.evaluate(
      "document.querySelector('#auth-phone-country').matches(':disabled') && document.querySelector('#auth-phone').matches(':disabled')",
    ),
    true,
    "Pending signup disables phone country and number",
  );
  await signedIn(client);
  assert.equal(operations.filter((op) => op.action === "register").length, 1);
  assert.equal(
    operations.find((op) => op.action === "register").phone,
    "+8801800000000",
  );
  assert.ok(
    !operations
      .find((op) => op.action === "register")
      .keys.includes("phoneCountry"),
  );
  assert.ok(
    await client.evaluate(
      "document.querySelector('[data-account-destination]')?.getAttribute('href') === '/dashboard'",
    ),
  );
  assert.equal(await client.evaluate("location.pathname"), "/learning");
  assert.equal(
    await client.evaluate(
      "document.cookie.includes('vetralink_access') || document.cookie.includes('vetralink_refresh')",
    ),
    false,
  );
  assert.equal(
    await client.evaluate(
      "Object.keys(localStorage).some(k => /auth|token|session/i.test(k)) || Object.keys(sessionStorage).some(k => /auth|token|session/i.test(k))",
    ),
    false,
  );
  const cookieState = await client.call("Network.getAllCookies");
  const authCookies = cookieState.cookies.filter(
    (value) =>
      value.name.startsWith("vetralink_") && /access|refresh/.test(value.name),
  );
  assert.equal(authCookies.length, 2);
  assert.ok(
    authCookies.every(
      (value) =>
        value.httpOnly &&
        value.secure &&
        value.session &&
        value.sameSite === "Lax",
    ),
  );
  await dismiss(client);
  await navigate(client, "/farm-management");
  assert.ok(
    await client.evaluate(
      "document.querySelector('header [data-avatar-trigger]')?.getAttribute('aria-label').includes('My account')",
    ),
  );
  const target2 = await (
    await fetch("http://127.0.0.1:9333/json/new?about:blank", {
      method: "PUT",
    })
  ).json();
  const second = await connect(target2);
  for (const session of sessions.values()) session.expired = true;
  await Promise.all([navigate(client, "/farm-management"), navigate(second)]);
  await until(() => refreshCount === 1, "Expected one cross-tab refresh");
  await until(
    async () =>
      (await client.evaluate(
        "!!document.querySelector('header [data-avatar-trigger]')",
      )) &&
      (await second.evaluate(
        "!!document.querySelector('header [data-avatar-trigger]')",
      )),
    "Cross-tab restore did not finish",
  );
  assert.equal(refreshCount, 1);
  // Refresh-only protected entry must hand off publicly and rotate only in the browser.
  await client.call("Network.deleteCookies", {
    name: "vetralink_access",
    url: origin,
  });
  const handoff = await fetch(origin + "/account/profile?section=access", {
    redirect: "manual",
    headers: { Cookie: `vetralink_refresh=${[...sessions.keys()].at(-1)}` },
  });
  assert.equal(handoff.status, 307);
  assert.equal(
    refreshCount,
    1,
    "Middleware must never consume a refresh token",
  );
  await client.call("Page.navigate", {
    url: origin + "/account/profile?section=access",
  });
  await until(
    () =>
      client.evaluate(
        `location.pathname==='/account/profile' && location.search==='?section=access' && !!document.querySelector('[data-account-profile]') && !document.querySelector('dialog[open]')`,
      ),
    "Refresh-only entry resumes requested profile",
  );
  assert.equal(
    refreshCount,
    2,
    "Browser performs one protected-entry rotation",
  );
  await navigate(client);
  for (const session of sessions.values()) session.expired = true;
  await openDialog(client, "login", 1440);
  await client.evaluate(
    `document.querySelector('[data-account-destination]').click()`,
  );
  await until(
    () =>
      client.evaluate(
        `location.pathname==='/dashboard' && !!document.querySelector('[data-dashboard-role]') && !document.querySelector('dialog[open]')`,
      ),
    "Expired access during client navigation restores before resuming",
  );
  assert.equal(
    refreshCount,
    3,
    "Existing provider revalidates after denied client navigation",
  );
  await navigate(client);
  await openDialog(client, "login", 1440);
  await dismiss(client);
  assert.ok(
    await client.evaluate(
      `document.activeElement.hasAttribute('data-avatar-trigger')`,
    ),
    "Escape restores avatar focus",
  );
  await client.call("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "ArrowDown",
    code: "ArrowDown",
    windowsVirtualKeyCode: 40,
  });
  await client.call("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "ArrowDown",
    code: "ArrowDown",
    windowsVirtualKeyCode: 40,
  });
  await until(
    () =>
      client.evaluate(
        `document.activeElement.hasAttribute('data-account-destination')`,
      ),
    "ArrowDown focuses account destination",
  );
  await client.evaluate(
    `document.body.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))`,
  );
  await until(
    () =>
      client.evaluate(`!document.querySelector('[data-public-account-panel]')`),
    "Outside pointer dismisses avatar menu",
  );
  await openDialog(client, "login", 1440);
  offline = true;
  await client.evaluate(
    "document.querySelector('[data-public-signout]').click()",
  );
  await until(
    () =>
      client.evaluate(
        "!!document.querySelector('[data-public-account-panel] [role=alert]')",
      ),
    "Logout failure feedback missing",
  );
  assert.ok(
    await client.evaluate(
      "!!document.querySelector('[data-public-account-panel]')",
    ),
  );
  offline = false;
  await client.evaluate(
    "document.querySelector('[data-public-signout]').click()",
  );
  await until(
    () =>
      client.evaluate(
        "!document.querySelector('dialog[open], [data-public-account-panel]')",
      ),
    "Logout did not finish",
  );
  await until(
    () =>
      second.evaluate(
        "document.querySelector('header [data-auth-trigger]').textContent.includes('Sign in')",
      ),
    "Other tab did not sign out",
  );

  await openDialog(client, "login", 1440);
  await fill(client, { email: "vet@example.test", password: "wrong" });
  await submit(client);
  await until(
    () =>
      client.evaluate(
        "document.querySelector('dialog [role=alert]')?.textContent.includes('incorrect')",
      ),
    "Invalid credentials message missing",
  );
  assert.equal(
    await client.evaluate("document.querySelector('#auth-email').value"),
    "vet@example.test",
  );
  await fill(client, { email: "suspended@example.test", password: "wrong" });
  await submit(client);
  await until(
    () =>
      client.evaluate(
        "document.querySelector('dialog [role=alert]')?.textContent.includes('suspended')",
      ),
    "Suspended feedback missing",
  );
  await fill(client, { email: "vet@example.test", password: "long password" });
  await submit(client);
  await signedIn(client);
  await dismiss(client);
  await navigate(client);
  await openDialog(client, "login", 1440);
  for (const session of sessions.values()) {
    session.expired = true;
    session.revoked = true;
  }
  await client.evaluate(
    "document.dispatchEvent(new Event('visibilitychange'))",
  );
  await until(
    () =>
      client.evaluate(
        "!!document.querySelector('header [data-auth-trigger]') && !document.querySelector('[data-avatar-trigger], [data-public-account-panel]')",
      ),
    "Expired session hides stale avatar/menu",
  );
  await openDialog(client, "login", 1440);
  await client.evaluate(
    "[...document.querySelectorAll('dialog button')].at(-1).click()",
  );
  await fill(client, {
    name: "Duplicate",
    email: "vet@example.test",
    password: "password1",
    confirmation: "password1",
  });
  await submit(client);
  await until(
    () =>
      client.evaluate(
        "document.querySelector('dialog [role=alert]')?.textContent.includes('already')",
      ),
    "Duplicate email feedback missing",
  );
  await fill(client, { email: "buyer@example.test", phone: "+8801700000000" });
  await submit(client);
  await until(
    () =>
      client.evaluate(
        "document.querySelector('dialog [role=alert]')?.textContent.includes('phone')",
      ),
    "Duplicate phone feedback missing",
  );
  await fill(client, { phone: "" });
  offline = true;
  await submit(client);
  await until(
    () =>
      client.evaluate(
        "document.querySelector('dialog [role=alert]')?.textContent.includes('connect')",
      ),
    "Unavailable service feedback missing",
  );
  offline = false;
  await chooseRole(client, "BUYER");
  await submit(client);
  await signedIn(client);
  assert.ok(
    await client.evaluate(
      "document.querySelector('[data-account-destination]')?.getAttribute('href') === '/dashboard'",
    ),
  );
  assert.ok(
    operations
      .filter((op) => op.action === "register")
      .every(
        (op) =>
          !op.keys.includes("confirmation") && !op.keys.includes("rememberMe"),
      ),
  );
  await dismiss(client);
  await client.call("Network.setCookie", {
    name: "vetralink-locale",
    value: "bn",
    url: origin,
  });
  await navigate(client);
  await openDialog(client, "login", 1440);
  await client.evaluate(
    "document.querySelector('[data-public-signout]').click()",
  );
  await until(
    () =>
      client.evaluate(
        "!document.querySelector('dialog[open], [data-public-account-panel]')",
      ),
    "Bangla logout did not finish",
  );
  await openDialog(client, "login", 1440);
  await fill(client, { email: "buyer@example.test", password: "wrong" });
  await submit(client);
  await until(
    () =>
      client.evaluate(
        "document.querySelector('dialog [role=alert]')?.textContent.includes('সঠিক নয়')",
      ),
    "Bangla API error missing",
  );
  await fill(client, { password: "password1" });
  await submit(client);
  await signedIn(client);
  const accountShot = await client.call("Page.captureScreenshot");
  const accountLocation = path.join(tempRoot, "bn-account.png");
  await writeFile(accountLocation, Buffer.from(accountShot.data, "base64"));
  screenshots.push(accountLocation);
  for (const item of clients) assert.deepEqual(item.exceptions, []);
  console.log(
    "Signup/login identity, exact payloads, protected cookies, navigation/reload, cross-tab rotation/logout, expiry and failure/retry passed",
  );
  console.log(`Screenshots: ${JSON.stringify(screenshots)}`);
  console.log(
    "Controlled upstream only; no real database, deployed API or provider was used.",
  );
  await new Promise((resolve, reject) => {
    const regression = spawn(
      process.execPath,
      ["scripts/check-localization.mjs", origin],
      {
        cwd: webDir,
        windowsHide: true,
        stdio: "inherit",
        env: { ...process.env, NODE_ENV: "production" },
      },
    );
    regression.on("error", reject);
    regression.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error("Public localization regression failed")),
    );
  });
} finally {
  if (clients[0]) await clients[0].call("Browser.close").catch(() => {});
  for (const client of clients) client.ws.close();
  if (chrome) chrome.kill();
  if (nextProcess) nextProcess.kill();
  await new Promise((resolve) => upstream.close(resolve));
  // Screenshots stay in OS temp for human/agent review. Browser profile is separate.
  const profile = path.resolve(tempRoot, "profile");
  const allowedRoot = path.resolve(tmpdir());
  if (
    !profile.startsWith(`${allowedRoot}${path.sep}`) ||
    !path.basename(tempRoot).startsWith("vetralink-auth-qa-")
  )
    throw new Error("Unsafe temporary cleanup target");
  await rm(profile, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 200,
  }).catch(() => {});
}
