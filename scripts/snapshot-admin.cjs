// Quick standalone CDP screenshotter for the dev server.
// Spawns Chrome at chrome:// flags, attaches via DevTools, navigates, screenshots, exits.
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const net = require("node:net");

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const OUT_DIR = path.join(__dirname, "..", "snapshots");
fs.mkdirSync(OUT_DIR, { recursive: true });

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); } catch { reject(new Error(`Bad JSON from ${url}: ${data.slice(0, 200)}`)); }
      });
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
  const url = process.argv[2] || "http://127.0.0.1:5199/admin";
  const outName = process.argv[3] || `admin-${Date.now()}.png`;
  const w = Number(process.argv[4] || 1440);
  const h = Number(process.argv[5] || 900);
  const userDataDir = path.join(__dirname, "..", ".chrome-snap");
  fs.rmSync(userDataDir, { recursive: true, force: true });
  fs.mkdirSync(userDataDir, { recursive: true });

  const debugPort = 9222 + Math.floor(Math.random() * 200);
  const args = [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--hide-scrollbars",
    "--disable-dev-shm-usage",
    `--user-data-dir=${userDataDir}`,
    `--remote-debugging-port=${debugPort}`,
    `--window-size=${w},${h}`,
    "about:blank"
  ];
  const proc = spawn(CHROME, args, { stdio: ["ignore", "pipe", "pipe"] });
  proc.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      console.error(`chrome exited with code ${code}`);
    }
  });

  const up = await waitForPort(debugPort);
  if (!up) {
    proc.kill();
    throw new Error("Chrome debug port never came up");
  }

  const tabs = await getJson(`http://127.0.0.1:${debugPort}/json`);
  const tab = tabs.find((t) => t.type === "page") || tabs[0];
  const wsUrl = tab.webSocketDebuggerUrl;
  if (!wsUrl) {
    proc.kill();
    throw new Error("No websocket URL on the active tab");
  }

  // Lazy-load ws from the node global if present, else require it.
  let WebSocket;
  try { WebSocket = require("ws"); } catch { /* fall through */ }
  if (!WebSocket) {
    // node 22 ships globalThis.WebSocket
    WebSocket = globalThis.WebSocket;
  }
  if (!WebSocket) {
    proc.kill();
    throw new Error("No WebSocket implementation (need ws or node>=22)");
  }

  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
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
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url });
  // wait for load
  await new Promise((resolve) => {
    const handler = (event) => {
      const msg = JSON.parse(event.data.toString());
      if (msg.method === "Page.loadEventFired") {
        ws.removeEventListener("message", handler);
        resolve();
      }
    };
    ws.addEventListener("message", handler);
  });
  // small settle
  await new Promise((r) => setTimeout(r, 2000));

  const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  const outPath = path.join(OUT_DIR, outName);
  fs.writeFileSync(outPath, Buffer.from(shot.data, "base64"));
  console.log(`OK ${url} -> ${outPath} (${(shot.data.length * 3 / 4 / 1024).toFixed(0)}KB)`);

  ws.close();
  proc.kill();
  // give it a moment
  await new Promise((r) => setTimeout(r, 200));
  process.exit(0);
}

main().catch((err) => {
  console.error(err.stack || err.message);
  process.exit(1);
});
