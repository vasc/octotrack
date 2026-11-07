import {
  BatchRequest,
  type Caller,
  Channel,
  contracts,
  type ErrorBody,
  type FeedEvent,
  type Hub,
  OctoError,
  toErrorBody,
  type Tracker,
  WatchWaitRequest,
  type WatchWaitResponse,
} from "@octotrack/core";
import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { streamSSE } from "hono/streaming";
import { z } from "zod";

export interface AppOptions {
  tracker: Tracker;
  hub: Hub;
  /** Serves the built dashboard. Injected so that this file stays free of runtime specifics. */
  assets?: (path: string) => Promise<Response | null>;
  /** Pulls PR state from GitHub now. Only available where `gh` can run. */
  syncPrs?: () => Promise<{ repos: number; synced: number; errors: string[] }>;
  /** Hostnames accepted in the Host header. See docs/DESIGN.md, D10. */
  allowedHosts?: readonly string[];
  /** How long a stream stays quiet before sending a keepalive. */
  keepaliveMs?: number;
}

const DEFAULT_HOSTS: readonly string[] = ["127.0.0.1", "localhost", "[::1]"];
const DEFAULT_HOLD_MS = 25_000;
const SSE_RETRY_MS = 1000;

const OpBody = z.object({ input: z.unknown().optional() });

function statusFor(code: string): ContentfulStatusCode {
  switch (code) {
    case "invalid_input":
    case "invalid_query":
      return 400;
    case "not_found":
    case "unknown_op":
      return 404;
    case "conflict":
    case "version_mismatch":
      return 409;
    default:
      return 500;
  }
}

function hostnameOf(host: string): string {
  return host.startsWith("[") ? host.slice(0, host.indexOf("]") + 1) : (host.split(":")[0] ?? host);
}

/** Header values are limited to Latin-1, so the client percent-encodes names. */
function decodeActor(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function callerFrom(headerActor: string | undefined, headerChannel: string | undefined): Caller {
  const channel = Channel.safeParse(headerChannel);
  const parsedChannel = channel.success ? channel.data : "cli";
  return {
    actor: decodeActor(headerActor)?.trim() || (parsedChannel === "dashboard" ? "dev" : "agent"),
    channel: parsedChannel,
  };
}

function describeOp(op: ReturnType<Tracker["listOps"]>[number]) {
  return {
    name: op.name,
    summary: op.summary,
    mutates: op.mutates,
    input: z.toJSONSchema(op.input, { io: "input", unrepresentable: "any" }),
    output: z.toJSONSchema(op.output, { unrepresentable: "any" }),
  };
}

export function createApp(options: AppOptions): Hono {
  const { tracker, hub, assets, syncPrs } = options;
  const allowedHosts = options.allowedHosts ?? DEFAULT_HOSTS;
  const keepaliveMs = options.keepaliveMs ?? 15_000;
  const app = new Hono();

  // No authentication, but a web page the developer happens to visit must not be able to approve decisions.
  app.use("*", async (c, next) => {
    const host = c.req.header("host");
    if (host !== undefined && !allowedHosts.includes(hostnameOf(host))) {
      return c.json({ ok: false, error: errorBody("forbidden", `Host ${host} is not allowed`) }, 403);
    }
    if (c.req.method === "POST" && !c.req.header("content-type")?.startsWith("application/json")) {
      return c.json({ ok: false, error: errorBody("invalid_input", "POST requires application/json") }, 415);
    }
    await next();
  });

  app.onError((error, c) => {
    const body = toErrorBody(error);
    return c.json({ ok: false, error: body }, statusFor(body.code));
  });

  app.get("/api/health", (c) => c.json({ ok: true, cursor: tracker.cursor(), pid: serverPid() }));

  app.get("/api/ops", (c) => c.json({ ok: true, data: tracker.listOps().map(describeOp) }));

  app.get("/api/ops/:name", (c) => {
    const op = tracker.listOps().find((item) => item.name === c.req.param("name"));
    if (op === undefined) throw new OctoError("unknown_op", `Unknown operation "${c.req.param("name")}"`);
    return c.json({ ok: true, data: describeOp(op) });
  });

  app.post("/api/ops/:name", async (c) => {
    const body = OpBody.parse(await c.req.json());
    const caller = callerFrom(c.req.header("x-octo-actor"), c.req.header("x-octo-channel"));
    const outcome = tracker.execute(c.req.param("name"), body.input, caller);
    return c.json({ ok: true, data: outcome.data, driftOpened: outcome.driftOpened, cursor: outcome.cursor });
  });

  app.post("/api/batch", async (c) => {
    const parsed = BatchRequest.safeParse(await c.req.json());
    if (!parsed.success) {
      throw new OctoError("invalid_input", `Invalid batch: ${z.prettifyError(parsed.error)}`);
    }
    const caller = callerFrom(c.req.header("x-octo-actor"), c.req.header("x-octo-channel"));
    return c.json(tracker.batch(parsed.data, caller));
  });

  app.post("/api/watch/wait", async (c) => {
    const parsed = WatchWaitRequest.safeParse(await c.req.json());
    if (!parsed.success) {
      throw new OctoError("invalid_input", `Invalid wait: ${z.prettifyError(parsed.error)}`);
    }
    const caller = callerFrom(c.req.header("x-octo-actor"), c.req.header("x-octo-channel"));
    const deadline = Date.now() + (parsed.data.holdMs ?? DEFAULT_HOLD_MS);
    while (true) {
      const results = tracker.call(contracts.watchCheck, { refs: parsed.data.refs }, caller);
      const remaining = deadline - Date.now();
      const fired = results.some((result) => result.fired);
      if (fired || remaining <= 0) {
        const response: WatchWaitResponse = { fired, results, cursor: tracker.cursor() };
        return c.json(response);
      }
      await hub.nextChange(remaining);
    }
  });

  // Plain GET so that index.html can preload it, which starts the fetch before any JS has been parsed.
  app.get("/api/bootstrap", (c) => {
    const query = c.req.query("q");
    const view = c.req.query("view");
    const data = tracker.call(
      contracts.dashboardBootstrap,
      { ...(query === undefined ? {} : { query }), ...(view === undefined ? {} : { view }) },
      { actor: "dev", channel: "dashboard" },
    );
    return c.json({ ok: true, data, driftOpened: [], cursor: data.cursor });
  });

  app.post("/api/github/sync", async (c) => {
    if (syncPrs === undefined)
      throw new OctoError("invalid_input", "PR sync is not available on this server");
    return c.json({ ok: true, data: await syncPrs(), driftOpened: [], cursor: tracker.cursor() });
  });

  app.get("/api/stream", (c) => {
    const since = Number(c.req.query("since") ?? tracker.cursor());
    return streamSSE(c, async (stream) => {
      let closed = false;
      let wake: () => void = () => {};
      const queue: (readonly FeedEvent[])[] = [];
      const remove = hub.addStream((events) => {
        queue.push(events);
        wake();
      });
      stream.onAbort(() => {
        closed = true;
        wake();
      });
      await stream.writeSSE({
        event: "hello",
        data: JSON.stringify({ cursor: tracker.cursor() }),
        retry: SSE_RETRY_MS,
      });
      const missed = tracker.eventsSince(Number.isFinite(since) ? since : tracker.cursor());
      if (missed.length > 0)
        await stream.writeSSE({ event: "change", data: JSON.stringify({ events: missed }) });
      try {
        while (!closed) {
          const batch = queue.shift();
          if (batch !== undefined) {
            await stream.writeSSE({ event: "change", data: JSON.stringify({ events: batch }) });
            continue;
          }
          const timedOut = await new Promise<boolean>((resolve) => {
            const timer = setTimeout(() => resolve(true), keepaliveMs);
            wake = () => {
              clearTimeout(timer);
              resolve(false);
            };
          });
          if (timedOut && !closed) await stream.writeSSE({ event: "ping", data: "{}" });
        }
      } finally {
        remove();
      }
    });
  });

  app.all("/api/*", (c) =>
    c.json(
      { ok: false, error: errorBody("not_found", `No such endpoint: ${c.req.method} ${c.req.path}`) },
      404,
    ),
  );

  app.get("*", async (c) => {
    const response = assets === undefined ? null : await assets(c.req.path);
    if (response !== null) return response;
    return c.text("The dashboard has not been built. Run: bun run build", 503);
  });

  return app;
}

function errorBody(code: string, message: string): ErrorBody {
  return { code, message, hint: null };
}

function serverPid(): number | null {
  return typeof globalThis.process?.pid === "number" ? globalThis.process.pid : null;
}
