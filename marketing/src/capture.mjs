// Renders video.html frame by frame through Chrome's DevTools protocol and pipes JPEG frames into ffmpeg.
// Usage: node capture.mjs <cut> <out.mp4> [fps] [from] [to]
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const [cut = "explainer", out = "out.mp4", fpsArg = "30", fromArg, toArg] = process.argv.slice(2);
const fps = Number(fpsArg);
const here = dirname(fileURLToPath(import.meta.url));
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9000 + Math.floor(Math.random() * 500);
const profile = mkdtempSync(join(tmpdir(), "octo-film-"));

const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    "--window-size=1920,1080",
    "--disable-gpu-vsync",
    "about:blank",
  ],
  { stdio: "ignore" },
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(what, fn, ms) {
  const end = Date.now() + ms;
  let last;
  while (Date.now() < end) {
    try {
      const v = await fn();
      if (v) return v;
    } catch (e) {
      last = e;
    }
    await sleep(200);
  }
  throw new Error(`timed out waiting for ${what}: ${last ?? "no value"}`);
}

try {
  const target = await until(
    "chrome",
    async () => {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" });
      return r.ok ? r.json() : null;
    },
    15000,
  );
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = rej;
  });
  let id = 0;
  const pending = new Map();
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? rej(new Error(msg.error.message)) : res(msg.result);
    }
  };
  const send = (method, params = {}) =>
    new Promise((res, rej) => {
      const i = ++id;
      pending.set(i, { res, rej });
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  const evaluate = async (expr) =>
    (await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true })).result
      .value;

  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    mobile: false,
  });
  const url = `${pathToFileURL(join(here, "video.html")).href}?cut=${cut}`;
  await send("Page.navigate", { url });
  await until(
    "page ready",
    () => evaluate('window.READY === true && document.fonts.status === "loaded"'),
    20000,
  );
  const duration = await evaluate("window.DURATION");
  const from = fromArg ? Number(fromArg) : 0;
  const to = toArg ? Number(toArg) : duration;
  const frames = Math.round((to - from) * fps);
  console.log(
    `${cut}: ${duration.toFixed(2)}s, rendering ${frames} frames ${from}-${to}s at ${fps}fps to ${out}`,
  );

  const ff = spawn(
    "ffmpeg",
    [
      "-y",
      "-loglevel",
      "error",
      "-f",
      "image2pipe",
      "-c:v",
      "mjpeg",
      "-framerate",
      String(fps),
      "-i",
      "-",
      "-c:v",
      "libx264",
      "-preset",
      "slow",
      "-crf",
      "18",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      out,
    ],
    { stdio: ["pipe", "inherit", "inherit"] },
  );
  const ffDone = new Promise((res, rej) =>
    ff.on("exit", (c) => (c === 0 ? res() : rej(new Error(`ffmpeg exited ${c}`)))),
  );

  const started = Date.now();
  for (let f = 0; f < frames; f++) {
    const t = from + f / fps;
    await evaluate(`render(${t})`);
    const shot = await send("Page.captureScreenshot", {
      format: "jpeg",
      quality: 94,
      captureBeyondViewport: false,
    });
    const buf = Buffer.from(shot.data, "base64");
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
    if (f % 300 === 0)
      console.log(`frame ${f}/${frames} after ${((Date.now() - started) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end();
  await ffDone;
  console.log(`done in ${((Date.now() - started) / 1000).toFixed(0)}s`);
  ws.close();
} finally {
  chrome.kill("SIGKILL");
}
