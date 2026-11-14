import { spawn } from "node:child_process";
import { existsSync, openSync } from "node:fs";
import {
  BatchResult,
  type BatchRequest,
  type Contract,
  type Drift,
  type Notice,
  ErrorBody,
  OctoError,
  OpEnvelope,
  WatchWaitResponse,
} from "@octotrack/core";
import { BUILD_ID } from "@octotrack/server/build";
import { withoutIdentity } from "@octotrack/server/env";
import { serverLogPath, serverStoppedPath } from "@octotrack/server/paths";
import { z } from "zod";
import { skewWarning } from "./skew.ts";

/** A local server starts in well under a second, so this is about twice the worst case seen. */
const SERVER_START_DEADLINE_MS = 5000;
const SERVER_START_POLL_MS = 50;

export class ConnectionError extends Error {}

export class RemoteError extends Error {
  readonly body: ErrorBody;

  constructor(body: ErrorBody) {
    super(body.message);
    this.body = body;
  }
}

export interface OpSuccess {
  data: unknown;
  driftOpened: Drift[];
  notices: Notice[];
  cursor: number;
}

export interface Typed<T> extends OpSuccess {
  data: T;
}

const AnyBody = z.object({ ok: z.literal(false), error: ErrorBody });

function isLoopback(url: string): boolean {
  const { hostname } = new URL(url);
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "[::1]";
}

/**
 * The environment a server this command starts runs with: this command's own, less who is calling. The server outlives
 * the command and runs wakes and sessions for every agent, so it must not act as the agent that started it.
 */
export function serverEnvironment(env: Readonly<Record<string, string | undefined>>): Record<string, string> {
  return withoutIdentity(env);
}

/** Who is calling beyond a name: the developer themself, or an agent relaying the developer's own words. */
export interface Identity {
  developer: boolean;
  said?: string;
  /** The git checkout the call comes from: with the name, it says which session this is. */
  checkout?: string;
}

export class OctoClient {
  private lastStartAt = 0;

  constructor(
    readonly baseUrl: string,
    /** Null when no name was given: the server then works out which agent uses this checkout. */
    readonly actor: string | null,
    /** How to run octo again, to start the server. */
    private readonly self: readonly string[],
    private readonly autoStart = true,
    readonly identity: Identity = { developer: false },
  ) {}

  private warnedAboutSkew = false;
  private heard: Notice[] = [];

  /** Says once per command when the server answering is from another build than this CLI. */
  private noticeBuild(response: Response): Response {
    const warning = skewWarning(BUILD_ID, response.headers.get("x-octo-build"));
    if (warning !== null && !this.warnedAboutSkew) {
      this.warnedAboutSkew = true;
      console.error(warning);
    }
    return response;
  }

  private async fetch(path: string, init: RequestInit, background = false): Promise<Response> {
    const response = await this.reach(path, init, background);
    return this.noticeBuild(response);
  }

  private async reach(path: string, init: RequestInit, background: boolean): Promise<Response> {
    const url = `${this.baseUrl}${path}`;
    try {
      return await fetch(url, init);
    } catch {
      if (!this.autoStart || !isLoopback(this.baseUrl)) {
        throw new ConnectionError(`Cannot reach the octotrack server at ${this.baseUrl}`);
      }
      await this.startServer(background);
      try {
        return await fetch(url, init);
      } catch {
        throw new ConnectionError(`Cannot reach the octotrack server at ${this.baseUrl}`);
      }
    }
  }

  /**
   * A long wait can outlive several server restarts, so this may start one again, just not while the last attempt could
   * still be coming up. Polling for a watch counts as background: it must not override `octo server stop`, whereas a
   * command someone ran now is a reason to start.
   */
  private async startServer(background: boolean): Promise<void> {
    if (background && existsSync(serverStoppedPath())) {
      throw new ConnectionError(`The server at ${this.baseUrl} was stopped`);
    }
    if (Date.now() - this.lastStartAt > SERVER_START_DEADLINE_MS) {
      this.lastStartAt = Date.now();
      const log = openSync(serverLogPath(), "a");
      const [program = process.execPath, ...prefix] = this.self;
      const child = spawn(program, [...prefix, "serve", "--port", new URL(this.baseUrl).port || "80"], {
        detached: true,
        stdio: ["ignore", log, log],
        env: serverEnvironment(process.env),
      });
      child.unref();
    }
    const deadline = Date.now() + SERVER_START_DEADLINE_MS;
    while (Date.now() < deadline) {
      try {
        const response = await fetch(`${this.baseUrl}/api/health`);
        if (response.ok) return;
      } catch {
        // Not up yet.
      }
      await Bun.sleep(SERVER_START_POLL_MS);
    }
    throw new ConnectionError(
      `Started a server but ${this.baseUrl} did not answer within ${SERVER_START_DEADLINE_MS}ms. See ${serverLogPath()}`,
    );
  }

  private headers(channel = "cli"): Record<string, string> {
    return {
      "content-type": "application/json",
      ...(this.actor === null ? {} : { "x-octo-actor": encodeURIComponent(this.actor) }),
      "x-octo-channel": channel,
      ...(this.identity.checkout === undefined
        ? {}
        : { "x-octo-checkout": encodeURIComponent(this.identity.checkout) }),
      ...(this.identity.developer ? { "x-octo-developer": "1" } : {}),
      ...(this.identity.said === undefined ? {} : { "x-octo-said": encodeURIComponent(this.identity.said) }),
    };
  }

  /** The same client, except that it will not start the server: for questions about the server itself. */
  withoutAutoStart(): OctoClient {
    return new OctoClient(this.baseUrl, this.actor, this.self, false, this.identity);
  }

  /** Housekeeping on the way out, which must not bring back a server that someone stopped. */
  async opInBackground(name: string, input: unknown): Promise<void> {
    await this.post(`/api/ops/${name}`, { input }, true);
  }

  async post(path: string, body: unknown, background = false): Promise<unknown> {
    const response = await this.fetch(
      path,
      { method: "POST", headers: this.headers(), body: JSON.stringify(body) },
      background,
    );
    return this.readBody(response);
  }

  async get(path: string): Promise<unknown> {
    const response = await this.fetch(path, { method: "GET" });
    return this.readBody(response);
  }

  private async readBody(response: Response): Promise<unknown> {
    const text = await response.text();
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      throw new OctoError("internal", `The server sent something that is not JSON: ${text.slice(0, 200)}`);
    }
    const failure = AnyBody.safeParse(body);
    if (failure.success) throw new RemoteError(failure.data.error);
    return body;
  }

  /** Runs any operation by name. Input is validated by the server, so that there is one source of truth. */
  async op(name: string, input: unknown): Promise<OpSuccess> {
    const envelope = OpEnvelope.parse(await this.post(`/api/ops/${name}`, { input }));
    if (!envelope.ok) throw new RemoteError(envelope.error);
    this.heard.push(...envelope.notices);
    return {
      data: envelope.data,
      driftOpened: envelope.driftOpened,
      cursor: envelope.cursor,
      notices: envelope.notices,
    };
  }

  /** Runs a known operation and validates what comes back, so that text renderers get real types. */
  async call<I extends z.ZodType, O extends z.ZodType>(
    contract: Contract<I, O>,
    input: unknown,
  ): Promise<Typed<z.output<O>>> {
    const outcome = await this.op(contract.name, input);
    return { ...outcome, data: contract.output.parse(outcome.data) };
  }

  async batch(request: BatchRequest): Promise<BatchResult> {
    const result = BatchResult.parse(await this.post("/api/batch", request));
    this.heard.push(...result.notices);
    return result;
  }

  async wait(refs: readonly string[], holdMs: number): Promise<WatchWaitResponse> {
    const response = WatchWaitResponse.parse(await this.post("/api/watch/wait", { refs, holdMs }, true));
    this.heard.push(...response.notices);
    return response;
  }

  /**
   * Every notice the server handed this command, on any call, that has not been shown yet. Notices are delivered once,
   * so a command that makes several calls, or prints its data without an envelope, must still show each of them.
   */
  takeNotices(): Notice[] {
    return this.heard.splice(0);
  }

  /** Marks notices as shown, when a command printed them itself. */
  shown(notices: readonly Notice[]): void {
    this.heard = this.heard.filter((notice) => !notices.includes(notice));
  }
}
