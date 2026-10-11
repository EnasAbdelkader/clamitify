// Auto-login + screenshot every admin route
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const net = require("node:net");

const CHROME = String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`;
const OUT_DIR = path.join(__dirname, "..", "snapshots");
fs.mkdirSync(OUT_DIR, { recursive: true });
const userDataDir = path.join(__dirname, "..", ".chrome-flow");
fs.rmSync(userDataDir, { recursive: true, force: true });
fs.mkdirSync(userDataDir, { recursive: true });

const ROUTES = [
  { path: "/admin", name: "01-dashboard" },
  { path: "/admin/content", name: "02-content" },
  { path: "/admin/messages", name: "03-messages" },
  { path: "/admin/settings", name: "04-settings" },
  { path: "/admin/analytics", name: "05-analytics" }
];

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = ""; res.on("data", (c) => (data += c));
      res.on("end", () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
    }).on("error", reject);
  });
}

async function waitForPort(port, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ok = await new Promise((resolve) => {
      const s = net.connect(port, "127.0.0.1");
      s.on("connect", () => { s.end(); resolve(true); });
      s.on("error", () => resolve(false));
    });
    if (ok) return true;
    await new Promise((r) => setTimeout(r, 150));
  }
  return false;
}

async function main() {
  const w = Number(process.argv[2] || 1440);
  const h = Number(process.argv[3] || 900);
  const debugPort = 9222 + Math.floor(Math.random() * 200);
  const args = [
    "--headless=new", "--disable-gpu", "--no-sandbox", "--hide-scrollbars", "--disable-dev-shm-usage",
    `--user-data-dir=${userDataDir}`, `--remote-debugging-port=${debugPort}`,
    `--window-size=${w},${h}`, "about:blank"
  ];
  const proc = spawn(CHROME, args, { stdio: ["ignore", "pipe", "pipe"] });
  proc.on("exit", () => {});

  if (!(await waitForPort(debugPort))) { proc.kill(); throw new Error("chrome never came up"); }

  const tabs = await getJson(`http://127.0.0.1:${debugPort}/json`);
  const tab = tabs.find((t) => t.type === "page");
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const reqId = ++id;
    pending.set(reqId, { resolve, reject });
    ws.send(JSON.stringify({ id: reqId, method, params }));
  });
  await new Promise((res) => ws.addEventListener("open", () => res(), { once: true }));
  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data.toString());
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    }
  });

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });

  // Step 1: navigate to /admin and log in
  await send("Page.navigate", { url: "http://127.0.0.1:5199/admin" });
  await new Promise((resolve) => {
    const handler = (event) => {
      const msg = JSON.parse(event.data.toString());
      if (msg.method === "Page.loadEventFired") { ws.removeEventListener("message", handler); resolve(); }
    };
    ws.addEventListener("message", handler);
  });
  await new Promise((r) => setTimeout(r, 2500));

  await send("Runtime.evaluate", { expression: `
    (() => {
      const setNative = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      const inputs = document.querySelectorAll("input");
      if (inputs[0]) { setNative.call(inputs[0], "admin@climatify.org"); inputs[0].dispatchEvent(new Event("input", { bubbles: true })); }
      if (inputs[1]) { setNative.call(inputs[1], "any-pass"); inputs[1].dispatchEvent(new Event("input", { bubbles: true })); }
      const form = document.querySelector("form");
      if (form) form.requestSubmit();
      return true;
    })()
  `, returnByValue: true });
  await new Promise((r) => setTimeout(r, 5000));

  // Step 2: navigate each route and screenshot
  for (const route of ROUTES) {
    await send("Page.navigate", { url: `http://127.0.0.1:5199${route.path}` });
    await new Promise((resolve) => {
      const handler = (event) => {
        const msg = JSON.parse(event.data.toString());
        if (msg.method === "Page.loadEventFired") { ws.removeEventListener("message", handler); resolve(); }
      };
      ws.addEventListener("message", handler);
    });
    // give the CMS content + analytics time to settle
    await new Promise((r) => setTimeout(r, 5500));
    const shot = await send("Page.captureScreenshot", { format: "png" });
    const outPath = path.join(OUT_DIR, `${route.name}.png`);
    fs.writeFileSync(outPath, Buffer.from(shot.data, "base64"));
    console.log(`OK ${route.path} -> ${outPath} (${(shot.data.length * 3 / 4 / 1024).toFixed(0)}KB)`);
  }

  ws.close();
  proc.kill();
  await new Promise((r) => setTimeout(r, 200));
  process.exit(0);
}

main().catch((err) => { console.error(err.stack || err.message); process.exit(1); });
