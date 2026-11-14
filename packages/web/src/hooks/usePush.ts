import { contracts } from "@octotrack/core/contracts";
import { PushSubscription } from "@octotrack/core/schemas";
import { useState } from "react";
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

function initialState(): PushState {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return "unsupported";
  }
  if (Notification.permission === "denied") return "blocked";
  return Notification.permission === "granted" ? "on" : "off";
}

/** Whether this browser buzzes for urgent questions and the top lines, and how to turn that on. */
export function usePush() {
  const [state, setState] = useState<PushState>(initialState);
  const [error, setError] = useState<string | null>(null);
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
