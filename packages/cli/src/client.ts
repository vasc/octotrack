import { spawn } from "node:child_process";
import { existsSync, openSync } from "node:fs";
import {
  BatchResult,
  type BatchRequest,
  type Contract,
  type Drift,
  ErrorBody,
  OctoError,
  OpEnvelope,
  WatchWaitResponse,
} from "@octotrack/core";
import { serverLogPath, serverStoppedPath } from "@octotrack/server/paths";
import { z } from "zod";

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

export class OctoClient {
  private lastStartAt = 0;

  constructor(
    readonly baseUrl: string,
    readonly actor: string,
    private readonly mainScript: string,
    private readonly autoStart = true,
  ) {}

  private async fetch(path: string, init: RequestInit, background = false): Promise<Response> {
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
      const child = spawn(
        process.execPath,
        [this.mainScript, "serve", "--port", new URL(this.baseUrl).port || "80"],
        {
          detached: true,
          stdio: ["ignore", log, log],
          env: process.env,
        },
      );
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
      "x-octo-actor": encodeURIComponent(this.actor),
      "x-octo-channel": channel,
    };
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
    return { data: envelope.data, driftOpened: envelope.driftOpened, cursor: envelope.cursor };
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
    return BatchResult.parse(await this.post("/api/batch", request));
  }

  async wait(refs: readonly string[], holdMs: number): Promise<WatchWaitResponse> {
    return WatchWaitResponse.parse(await this.post("/api/watch/wait", { refs, holdMs }, true));
  }
}
