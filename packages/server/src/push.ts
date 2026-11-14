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

export interface PushDispatcher {
  dispatch(): Promise<void>;
  /** Dispatches after each change. Returns how to stop. */
  listen(): () => void;
}

/** Sends every notification due to every subscribed browser, then records them, so each buzzes once. */
export function createPushDispatcher(options: { tracker: Tracker; send: PushSender }): PushDispatcher {
  const { tracker, send } = options;
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
      for (const subscription of subscriptions) {
        for (const note of due) {
          // One browser's push service failing costs that browser this notification, nothing more: the others still
          // hear it, and it is recorded as sent, since a line buzzes at most once (D14).
          let result: { statusCode: number };
          try {
            result = await send(
              subscription,
              JSON.stringify({ title: note.title, body: note.body, url: note.url }),
            );
          } catch (error) {
            console.error(`[push] ${subscription.endpoint}:`, error);
            break;
          }
          if (GONE.has(result.statusCode)) {
            tracker.call(contracts.pushUnsubscribe, { endpoint: subscription.endpoint }, SERVER);
            break;
          }
        }
      }
      tracker.call(contracts.pushSent, { keys: due.map((note) => note.key) }, SERVER);
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
