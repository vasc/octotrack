import { beforeEach, describe, expect, test } from "bun:test";
import {
  BatchResult,
  type Bootstrap,
  contracts as c,
  Hub,
  OpEnvelope,
  Tracker,
  WatchWaitResponse,
} from "@octotrack/core";
import type { Hono } from "hono";
import { z } from "zod";
import { createApp } from "../src/app.ts";
import { openSqlite } from "../src/sqlite.ts";

const BASE = "http://127.0.0.1:4747";
let tracker: Tracker;
let app: Hono;

async function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  return app.request(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

async function op(name: string, input: unknown, actor = "agent-a") {
  const response = await post(`/api/ops/${name}`, { input }, { "x-octo-actor": actor });
  return { status: response.status, body: OpEnvelope.parse(await response.json()) };
}

beforeEach(() => {
  tracker = new Tracker(openSqlite(":memory:"));
  app = createApp({ tracker, hub: new Hub(tracker), keepaliveMs: 20 });
});

describe("operations over HTTP", () => {
  test("runs an op and reports who did it", async () => {
    const created = await op("project.create", { key: "OCT", name: "Octotrack" }, "agent-z");
    expect(created.status).toBe(200);
    expect(created.body.ok).toBe(true);
    const feed = tracker.call(c.feedList, {}, { actor: "x", channel: "cli" });
    expect(feed.events[0]?.actor).toBe("agent-z");
  });

  test("returns drift the write caused", async () => {
    await op("project.create", { key: "OCT", name: "Octotrack" });
    const asked = await op("decision.ask", { title: "Q", project: "OCT" });
    expect(asked.body.ok).toBe(true);
    const resolved = await op("decision.resolve", { ref: "D-1", note: "yes" });
    expect(resolved.body.ok && resolved.body.driftOpened.map((drift) => drift.rule)).toEqual([
      "decision-project-sync",
    ]);
  });

  test.each([
    ["unknown op", "nope.nope", {}, 404, "unknown_op"],
    ["bad input", "project.create", { key: "OCT" }, 400, "invalid_input"],
    ["unknown input field", "project.create", { key: "OCT", name: "x", typo: 1 }, 400, "invalid_input"],
    ["missing ref", "entity.show", { ref: "OCT-1" }, 404, "not_found"],
    ["bad query", "feed.list", { query: "nope:1" }, 400, "invalid_query"],
  ])("maps %s to a status and a code", async (_label, name, input, status, code) => {
    const result = await op(name, input);
    expect(result.status).toBe(status);
    expect(result.body.ok === false && result.body.error.code).toBe(code);
  });

  test("the dashboard channel is recorded on decisions", async () => {
    await op("decision.ask", { title: "Q" });
    const response = await post(
      "/api/ops/decision.resolve",
      { input: { ref: "D-1", note: "yes" } },
      { "x-octo-channel": "dashboard" },
    );
    const body = OpEnvelope.parse(await response.json());
    expect(body.ok && c.decisionResolve.output.parse(body.data)).toMatchObject({
      channel: "dashboard",
      decidedBy: "dev",
    });
  });

  test("lists operations with their input schemas", async () => {
    const response = await app.request(`${BASE}/api/ops`);
    const body = z
      .object({ data: z.array(z.object({ name: z.string(), input: z.unknown() })) })
      .parse(await response.json());
    expect(body.data.map((item) => item.name)).toContain("decision.resolve");
    const one = await app.request(`${BASE}/api/ops/decision.resolve`);
    expect(one.status).toBe(200);
  });

  test("batches over HTTP", async () => {
    await op("project.create", { key: "OCT", name: "Octotrack" });
    const response = await post("/api/batch", {
      ops: [
        { op: "issue.create", as: "i", input: { project: "OCT", title: "One" } },
        { op: "update.post", input: { body: "Started", target: "$i.ref" } },
      ],
    });
    const body = BatchResult.parse(await response.json());
    expect(body.ok).toBe(true);
    expect(body.results).toHaveLength(2);
  });
});

describe("protection without authentication", () => {
  test("refuses a foreign Host header, which stops DNS rebinding", async () => {
    const response = await app.request("http://evil.example/api/health", {
      headers: { host: "evil.example" },
    });
    expect(response.status).toBe(403);
  });

  test("accepts loopback hosts with a port", async () => {
    for (const host of ["127.0.0.1:4747", "localhost:4747", "[::1]:4747"]) {
      const response = await app.request(`${BASE}/api/health`, { headers: { host } });
      expect(response.status).toBe(200);
    }
  });

  test("refuses a POST that a web page could send without a preflight", async () => {
    const response = await app.request(`${BASE}/api/ops/decision.resolve`, {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: JSON.stringify({ input: { ref: "D-1", note: "pwned" } }),
    });
    expect(response.status).toBe(415);
  });

  test("sends no CORS headers", async () => {
    const response = await app.request(`${BASE}/api/health`, { headers: { origin: "https://evil.example" } });
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });
});

describe("watch long poll", () => {
  async function createWatch(query: string) {
    const created = await op("watch.create", {
      spec: { clauses: [{ type: "state", query }] },
    });
    if (!created.body.ok) throw new Error("watch.create failed");
    return c.watchCreate.output.parse(created.body.data).ref;
  }

  test("returns at once when already satisfied", async () => {
    await op("decision.ask", { title: "Q" });
    await op("decision.resolve", { ref: "D-1", note: "yes" });
    const ref = await createWatch("ref:D-1 status:decided");
    const response = await post("/api/watch/wait", { refs: [ref], holdMs: 5000 });
    expect(WatchWaitResponse.parse(await response.json()).fired).toBe(true);
  });

  test("hangs until a write satisfies it", async () => {
    await op("decision.ask", { title: "Q" });
    const ref = await createWatch("ref:D-1 status:decided");
    const started = Date.now();
    const pending = post("/api/watch/wait", { refs: [ref], holdMs: 5000 }).then(async (response) =>
      WatchWaitResponse.parse(await response.json()),
    );
    await Bun.sleep(30);
    await op("decision.resolve", { ref: "D-1", note: "yes" });
    const result = await pending;
    expect(result.fired).toBe(true);
    expect(Date.now() - started).toBeLessThan(2000);
  });

  test("gives back a not-fired response when the hold ends, for the client to poll again", async () => {
    await op("decision.ask", { title: "Q" });
    const ref = await createWatch("ref:D-1 status:decided");
    const response = await post("/api/watch/wait", { refs: [ref], holdMs: 20 });
    expect(WatchWaitResponse.parse(await response.json()).fired).toBe(false);
  });

  test("errors on an unknown watch", async () => {
    const response = await post("/api/watch/wait", { refs: ["W-99"], holdMs: 10 });
    expect(response.status).toBe(404);
  });
});

describe("bootstrap and stream", () => {
  test("bootstrap is a GET with everything for first paint", async () => {
    await op("project.create", { key: "OCT", name: "Octotrack" });
    await op("decision.ask", { title: "Q", project: "OCT", priority: "urgent" });
    await op("pr.upsert", { repo: "a/b", number: 1, title: "PR", state: "open", checks: "failing" });
    const response = await app.request(`${BASE}/api/bootstrap`);
    const envelope = OpEnvelope.parse(await response.json());
    const data: Bootstrap | false = envelope.ok && c.dashboardBootstrap.output.parse(envelope.data);
    if (data === false) throw new Error("bootstrap failed");
    expect(data.counts).toMatchObject({ openDecisions: 1, openPrs: 1, failingPrs: 1 });
    expect(data.queue[0]?.decision.ref).toBe("D-1");
    expect(data.prs[0]?.attention).toContain("checks failing");
    expect(data.views[0]?.name).toBe("Feed");
    expect(data.feed.events.length).toBeGreaterThan(0);
  });

  test("the stream replays what was missed, then pushes new changes", async () => {
    const before = tracker.cursor();
    await op("decision.ask", { title: "Missed" });
    const response = await app.request(`${BASE}/api/stream?since=${before}`);
    const reader = response.body?.getReader();
    if (reader === undefined) throw new Error("no stream");
    const decoder = new TextDecoder();
    let received = "";
    const deadline = Date.now() + 2000;
    let wrote = false;
    while (Date.now() < deadline && !received.includes("Second")) {
      const { value, done } = await reader.read();
      if (done) break;
      received += decoder.decode(value);
      if (received.includes("Missed") && !wrote) {
        wrote = true;
        await op("decision.ask", { title: "Second" });
      }
    }
    await reader.cancel();
    expect(received).toContain("event: hello");
    expect(received).toContain("Missed");
    expect(received).toContain("Second");
  });
});

describe("static fallbacks", () => {
  test("says how to build when the dashboard is missing", async () => {
    const response = await app.request(`${BASE}/`);
    expect(response.status).toBe(503);
    expect(await response.text()).toContain("bun run build");
  });

  test("unknown API paths are JSON, not the dashboard", async () => {
    const response = await app.request(`${BASE}/api/nope`);
    expect(response.status).toBe(404);
    expect(OpEnvelope.parse(await response.json()).ok).toBe(false);
  });
});
