import { contracts } from "@octotrack/core/contracts";
import { PushSubscription } from "@octotrack/core/schemas";
import { useEffect, useState } from "react";
import { z } from "zod";
import { callOp } from "../api/client.ts";

export type PushState = "unsupported" | "off" | "on" | "blocked" | "turning-on";

const KeyResponse = z.object({ publicKey: z.string().nullable() });

/** The server's public key, as the Push API wants it: bytes, from URL-safe base64. */
function keyBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = `${base64}${"=".repeat((4 - (base64.length % 4)) % 4)}`
    .replaceAll("-", "+")
    .replaceAll("_", "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

function supported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
}

/** Permission alone is not a subscription: it stays off until the browser is seen to hold one. */
function initialState(): PushState {
  if (!supported()) return "unsupported";
  return Notification.permission === "denied" ? "blocked" : "off";
}

/** Whether this browser buzzes for urgent questions and the top lines, and how to turn that on. */
export function usePush() {
  const [state, setState] = useState<PushState>(initialState);
  const [error, setError] = useState<string | null>(null);
  // The browser's own subscription, brought into the page once: on only if it holds one, and the server is told of it
  // again in case it lost it.
  useEffect(() => {
    if (!supported() || Notification.permission !== "granted") return;
    let live = true;
    const check = async () => {
      const registration = await navigator.serviceWorker.getRegistration("/sw.js");
      const subscription = await registration?.pushManager.getSubscription();
      if (!live || subscription === null || subscription === undefined) return;
      await callOp(contracts.pushSubscribe, PushSubscription.parse(subscription.toJSON()));
      if (live) setState("on");
    };
    check().catch((failure: unknown) => {
      if (live) setError(failure instanceof Error ? failure.message : String(failure));
    });
    return () => {
      live = false;
    };
  }, []);
  return {
    state,
    error,
    async turnOn() {
      setState("turning-on");
      setError(null);
      try {
        const key = KeyResponse.parse(await (await fetch("/api/push/key")).json()).publicKey;
        if (key === null) throw new Error("This server does not send notifications");
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setState(permission === "denied" ? "blocked" : "off");
          return;
        }
        const registration = await navigator.serviceWorker.register("/sw.js");
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyBytes(key),
        });
        await callOp(contracts.pushSubscribe, PushSubscription.parse(subscription.toJSON()));
        setState("on");
      } catch (failure) {
        setError(failure instanceof Error ? failure.message : String(failure));
        setState("off");
      }
    },
  };
}
