import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { type Caller, contracts, type PushSubscription, type Tracker } from "@octotrack/core";
import * as webpush from "web-push";
import { z } from "zod";

const SERVER: Caller = { actor: "octotrack", channel: "cli", system: true };

const Vapid = z.object({ publicKey: z.string().min(1), privateKey: z.string().min(1) });
export type Vapid = z.infer<typeof Vapid>;

/** The server's own Web Push identity: made on first use, then kept, readable only by the developer. */
export function loadOrCreateVapid(path: string): Vapid {
  if (existsSync(path)) return Vapid.parse(JSON.parse(readFileSync(path, "utf8")));
  const keys = Vapid.parse(webpush.generateVAPIDKeys());
  writeFileSync(path, JSON.stringify(keys), { mode: 0o600 });
  chmodSync(path, 0o600);
  return keys;
}

/** Sends one payload to one browser. Injected, so tests never reach a push service. */
export type PushSender = (subscription: PushSubscription, payload: string) => Promise<{ statusCode: number }>;

export function webPushSender(vapid: Vapid, contact: string): PushSender {
  return async (subscription, payload) => {
    try {
      const result = await webpush.sendNotification(subscription, payload, {
        vapidDetails: { subject: contact, publicKey: vapid.publicKey, privateKey: vapid.privateKey },
        TTL: 60 * 60,
        timeout: SEND_DEADLINE_MS,
      });
      return { statusCode: result.statusCode };
    } catch (error) {
      if (error instanceof webpush.WebPushError) return { statusCode: error.statusCode };
      throw error;
    }
  };
}

/** A subscription the push service no longer knows. */
const GONE = new Set([404, 410]);
/** A push service answers in a second or two; past this it is not going to, and the next send must not wait on it. */
const SEND_DEADLINE_MS = 30_000;

/** What a send came to: accepted, refused for good, or not answered (a network error, a timeout, a busy service). */
type Sent = "accepted" | "gone" | "refused" | "unanswered";

function outcomeOf(statusCode: number): Sent {
  if (GONE.has(statusCode)) return "gone";
  if (statusCode >= 200 && statusCode < 300) return "accepted";
  // Too many requests and the service's own errors are worth trying again; any other refusal will not change.
  return statusCode === 429 || statusCode >= 500 ? "unanswered" : "refused";
}

/** The send's answer, or "unanswered" once its deadline passes or it fails to reach the service. */
async function sendWithin(
  send: () => Promise<{ statusCode: number }>,
  deadlineMs: number,
): Promise<{ sent: Sent; error?: unknown }> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<{ sent: Sent; error?: unknown }>((resolve) => {
    timer = setTimeout(
      () => resolve({ sent: "unanswered", error: new Error(`no answer within ${deadlineMs}ms`) }),
      deadlineMs,
    );
  });
  try {
    return await Promise.race([
      send().then(
        (result) => ({ sent: outcomeOf(result.statusCode) }),
        (error: unknown) => ({ sent: "unanswered" as const, error }),
      ),
      expired,
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export interface PushDispatcher {
  dispatch(): Promise<void>;
  /** Dispatches after each change. Returns how to stop. */
  listen(): () => void;
}

/**
 * Sends every notification due to every subscribed browser, then records the ones some browser took, so each buzzes
 * once. One no browser could be sent, because no push service answered in time, stays due and is tried again on the
 * next dispatch: urgent questions always buzz (D14). Each send has a deadline, so one that never answers holds up
 * nothing after it.
 */
export function createPushDispatcher(options: {
  tracker: Tracker;
  send: PushSender;
  sendDeadlineMs?: number;
}): PushDispatcher {
  const { tracker, send, sendDeadlineMs = SEND_DEADLINE_MS } = options;
  let busy = false;
  const dispatch = async () => {
    if (busy) return;
    busy = true;
    try {
      const due = tracker.call(contracts.pushDue, {}, SERVER);
      if (due.length === 0) return;
      const subscriptions = tracker.call(contracts.pushSubscriptions, {}, SERVER);
      // Nobody to tell yet: keep them due, for the first phone that subscribes.
      if (subscriptions.length === 0) return;
      /** Notifications done with: some browser took them, or a push service refused them for good. */
      const done = new Set<string>();
      for (const subscription of subscriptions) {
        for (const note of due) {
          const { sent, error } = await sendWithin(
            () => send(subscription, JSON.stringify({ title: note.title, body: note.body, url: note.url })),
            sendDeadlineMs,
          );
          if (sent === "gone") {
            tracker.call(contracts.pushUnsubscribe, { endpoint: subscription.endpoint }, SERVER);
            break;
          }
          if (sent === "unanswered") {
            // This browser's push service is not answering: the rest of its notifications wait for the next try.
            console.error(`[push] ${subscription.endpoint}:`, error);
            break;
          }
          done.add(note.key);
        }
      }
      // Recorded once some browser took it, so a line still buzzes once; kept due while no browser has.
      const keys = due.map((note) => note.key).filter((key) => done.has(key));
      if (keys.length > 0) tracker.call(contracts.pushSent, { keys }, SERVER);
    } catch (error) {
      console.error("[push]", error);
    } finally {
      busy = false;
    }
  };
  return {
    dispatch,
    listen() {
      return tracker.subscribe(() => {
        void Promise.resolve().then(dispatch);
      });
    },
  };
}
