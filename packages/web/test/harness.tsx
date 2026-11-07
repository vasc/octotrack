import { contracts, type Contract } from "@octotrack/core/contracts";
import { Hub, Tracker } from "@octotrack/core";
import { createApp, openSqlite } from "@octotrack/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type RenderResult, render } from "@testing-library/react";
import type { ReactNode } from "react";
import type { z } from "zod";

/** Stands in for the browser's EventSource, so that a test can push a change whenever it wants to. */
export class FakeEventSource {
  static instances: FakeEventSource[] = [];
  private listeners = new Map<string, (() => void)[]>();

  constructor(readonly url: string) {
    FakeEventSource.instances.push(this);
  }

  closed = false;

  addEventListener(type: string, listener: () => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  emit(type: string): void {
    for (const listener of this.listeners.get(type) ?? []) listener();
  }

  close(): void {
    this.closed = true;
  }
}

export interface TestServer {
  tracker: Tracker;
  /** Every operation name the dashboard called, in order. */
  calls: string[];
  /** Writes to the tracker the way an agent would, behind the dashboard's back. */
  act<I extends z.ZodType, O extends z.ZodType>(
    contract: Contract<I, O>,
    input: z.input<I>,
    actor?: string,
  ): z.output<O>;
}

/** The real server app with an in-memory database, answering the dashboard's fetches directly. */
export function startTestServer(options: { live?: boolean } = {}): TestServer {
  const tracker = new Tracker(openSqlite(":memory:"));
  const app = createApp({ tracker, hub: new Hub(tracker) });
  if (options.live === true) {
    // Wires the real change notifications to the page, so that a test can prove what really reaches it.
    tracker.subscribe(() => {
      for (const source of FakeEventSource.instances) {
        if (!source.closed) source.emit("change");
      }
    });
  }
  const calls: string[] = [];
  const answer = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(input), "http://127.0.0.1:4747");
    const opName = /^\/api\/ops\/(.+)$/.exec(url.pathname)?.[1];
    if (opName !== undefined) calls.push(opName);
    return app.request(url.toString(), init);
  };
  Object.assign(globalThis, { fetch: answer, EventSource: FakeEventSource });
  FakeEventSource.instances = [];
  return {
    tracker,
    calls,
    act(contract, input, actor = "agent-a") {
      return tracker.call(contract, input, { actor, channel: "cli" });
    },
  };
}

export function renderApp(ui: ReactNode): RenderResult {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

export { contracts };
