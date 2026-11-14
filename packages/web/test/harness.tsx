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
  private listeners = new Map<string, ((event: { data: string }) => void)[]>();

  constructor(readonly url: string) {
    FakeEventSource.instances.push(this);
  }

  closed = false;

  addEventListener(type: string, listener: (event: { data: string }) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  emit(type: string, data = "{}"): void {
    for (const listener of this.listeners.get(type) ?? []) listener({ data });
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
  /** Moves the server's clock on, for rules that turn on time passing. */
  later(minutes: number): void;
}

/** The real server app with an in-memory database, answering the dashboard's fetches directly. */
export function startTestServer(options: { live?: boolean; pushKey?: string } = {}): TestServer {
  // Real time, plus however far a test moved it on, so that Undo windows still run out on their own.
  let offset = 0;
  const tracker = new Tracker(openSqlite(":memory:"), () => new Date(Date.now() + offset).toISOString());
  const app = createApp({
    tracker,
    hub: new Hub(tracker),
    ...(options.pushKey === undefined ? {} : { pushKey: options.pushKey }),
  });
  if (options.live === true) {
    // Wires the real change notifications to the page, so that a test can prove what really reaches it.
    tracker.subscribe(() => {
      for (const source of FakeEventSource.instances) {
        if (!source.closed) source.emit("change");
      }
    });
    tracker.onDraft((key) => {
      for (const source of FakeEventSource.instances) {
        if (!source.closed) source.emit("draft", JSON.stringify({ key }));
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
    later(minutes) {
      offset += minutes * 60_000;
    },
  };
}

/** The page, and its query client, so a test can refresh what the page shows as a change notice would. */
export function renderApp(ui: ReactNode): RenderResult & { client: QueryClient } {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
  });
  return Object.assign(render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>), { client });
}

export { contracts };

/**
 * Matches an element whose whole text is this sentence, even when parts of it are their own elements, such as
 * markdown inside a line of words. Only the innermost such element matches, so a lookup finds exactly one.
 */
export function whole(text: string) {
  return (_content: string, element: Element | null): boolean =>
    element !== null &&
    element.textContent === text &&
    [...element.children].every((child) => child.textContent !== text);
}

/** Like whole, for a sentence that varies, such as a countdown: the innermost element whose whole text matches. */
export function wholeMatching(pattern: RegExp) {
  return (_content: string, element: Element | null): boolean =>
    element !== null &&
    pattern.test(element.textContent ?? "") &&
    [...element.children].every((child) => !pattern.test(child.textContent ?? ""));
}

interface FakeSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/**
 * The browser's push machinery, as far as the dashboard uses it: permission, a service worker registration and its
 * subscription. Returns what the page subscribed, and how to put the real globals back.
 */
export function fakePush(options: {
  permission: NotificationPermission;
  subscribed: FakeSubscription | null;
}) {
  let current = options.subscribed;
  const asBrowserHas = (json: FakeSubscription) => ({ endpoint: json.endpoint, toJSON: () => json });
  const registration = {
    pushManager: {
      getSubscription: async () => (current === null ? null : asBrowserHas(current)),
      subscribe: async () => {
        current = { endpoint: "https://push.example/new", keys: { p256dh: "BNew", auth: "fresh" } };
        return asBrowserHas(current);
      },
    },
  };
  const before = {
    serviceWorker: Object.getOwnPropertyDescriptor(navigator, "serviceWorker"),
    PushManager: Reflect.get(window, "PushManager"),
    Notification: Reflect.get(window, "Notification"),
  };
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { register: async () => registration, getRegistration: async () => registration },
  });
  Object.assign(window, {
    PushManager: class {},
    Notification: { permission: options.permission, requestPermission: async () => "granted" },
  });
  return {
    subscribed: () => current,
    restore() {
      if (before.serviceWorker === undefined) Reflect.deleteProperty(navigator, "serviceWorker");
      else Object.defineProperty(navigator, "serviceWorker", before.serviceWorker);
      Object.assign(window, { PushManager: before.PushManager, Notification: before.Notification });
    },
  };
}
