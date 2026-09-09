// Drive the running meleelight page over the Chrome DevTools Protocol so the
// game can be started, stepped and inspected from here. Node 22+ has a global
// WebSocket, so this needs no dependencies.
//
//   node cdp.mjs <url> <script.js>
//
// <script.js> is evaluated in the page (as an async IIFE body) and whatever it
// returns is printed as JSON.
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";

const CHROME =
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const URL_ = process.argv[2];
const SCRIPT_PATH = process.argv[3];
const PORT = 9333;
const PROFILE = process.argv[4] || "C:\\Temp\\ml-cdp-profile";

const body = readFileSync(SCRIPT_PATH, "utf8");

const chrome = spawn(CHROME, [
  "--headless=new",
  "--disable-gpu",
  "--no-sandbox",
  "--mute-audio",
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${PROFILE}`,
  "--window-size=1280,900",
  URL_,
], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function findTarget() {
  for (let i = 0; i < 100; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await res.json();
      const page = list.find((t) => t.type === "page" && t.url.includes("meleelight"));
      if (page && page.webSocketDebuggerUrl) return page;
    } catch (e) { /* not up yet */ }
    await sleep(200);
  }
  throw new Error("could not find the page target");
}

const target = await findTarget();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));

let nextId = 1;
const pending = new Map();
const consoleLines = [];

ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id !== undefined) {
    const p = pending.get(msg.id);
    if (p) { pending.delete(msg.id); p(msg); }
  } else if (msg.method === "Runtime.consoleAPICalled") {
    consoleLines.push(msg.params.args.map(a =>
      a.value !== undefined ? a.value : a.description).join(" "));
  } else if (msg.method === "Runtime.exceptionThrown") {
    const d = msg.params.exceptionDetails;
    consoleLines.push("EXCEPTION: " + (d.exception?.description || d.text));
  }
});

function send(method, params = {}) {
  const id = nextId++;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((r) => pending.set(id, r));
}

await send("Runtime.enable");
await send("Page.enable");

// Give the bundles time to load and start() to run.
await sleep(6000);

const res = await send("Runtime.evaluate", {
  expression: `(async () => { ${body} })()`,
  awaitPromise: true,
  returnByValue: true,
  allowUnsafeEvalBlobs: true,
});

if (res.result?.exceptionDetails) {
  console.log("PAGE EXCEPTION:");
  console.log(JSON.stringify(res.result.exceptionDetails, null, 2).slice(0, 4000));
} else {
  console.log(JSON.stringify(res.result?.result?.value, null, 2));
}

if (consoleLines.length) {
  console.log("\n--- page console ---");
  for (const l of consoleLines.slice(0, 60)) console.log("  " + l);
}

ws.close();
chrome.kill();
process.exit(0);
