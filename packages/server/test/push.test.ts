import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { contracts as c, Tracker } from "@octotrack/core";
import { createPushDispatcher, loadOrCreateVapid, type PushSender } from "../src/push.ts";
import { openSqlite } from "../src/sqlite.ts";

const DEV = { actor: "dev", channel: "dashboard" } as const;
const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function world(status = 201) {
  const tracker = new Tracker(openSqlite(":memory:"));
  tracker.call(c.projectCreate, { key: "PANEL", name: "Panel" }, DEV);
  tracker.call(c.lineAdd, { title: "Enclosure", doneWhen: "Done.", repos: ["PANEL"], where: "working" }, DEV);
  tracker.call(c.agentRegister, { repo: "PANEL" }, { actor: "panel", channel: "cli" });
  tracker.call(c.lineTake, { ref: "L-1" }, { actor: "panel", channel: "cli" });
  tracker.call(
    c.pushSubscribe,
    { endpoint: "https://push.example/phone", keys: { p256dh: "BKey", auth: "secret" } },
    DEV,
  );
  const sent: { endpoint: string; payload: unknown }[] = [];
  const send: PushSender = async (subscription, payload) => {
    sent.push({ endpoint: subscription.endpoint, payload: JSON.parse(payload) });
    return { statusCode: status };
  };
  const ask = (title: string) =>
    tracker.call(
      c.decisionAsk,
      {
        title,
        context: "The base is printed.",
        options: [{ key: "a", label: "26 mm", description: "As it is." }],
        recommendation: "a",
        why: "Proven.",
      },
      { actor: "panel", channel: "cli" },
    );
  return { tracker, sent, dispatcher: createPushDispatcher({ tracker, send }), ask };
}

describe("buzzing the phone", () => {
  test("sends what is due to every subscribed browser, once", async () => {
    const w = world();
    const asked = w.ask("Which board?");
    await w.dispatcher.dispatch();
    await w.dispatcher.dispatch();
    expect(w.sent).toEqual([
      {
        endpoint: "https://push.example/phone",
        payload: {
          title: "Enclosure: Which board?",
          body: "Recommended: 26 mm, Proven.",
          url: `/?focus=${asked.ref}`,
        },
      },
    ]);
  });

  test("with no browser subscribed nothing counts as sent, so a phone subscribed later still hears what is due", async () => {
    const w = world();
    w.tracker.call(c.pushUnsubscribe, { endpoint: "https://push.example/phone" }, DEV);
    w.ask("Which board?");
    await w.dispatcher.dispatch();
    w.tracker.call(
      c.pushSubscribe,
      { endpoint: "https://push.example/phone", keys: { p256dh: "BKey", auth: "secret" } },
      DEV,
    );
    await w.dispatcher.dispatch();
    expect(w.sent.map((sent) => sent.endpoint)).toEqual(["https://push.example/phone"]);
  });

  test("a browser the push service says is gone is forgotten", async () => {
    const w = world(410);
    w.ask("Which board?");
    await w.dispatcher.dispatch();
    expect(
      w.tracker.call(c.pushSubscriptions, {}, { actor: "octotrack", channel: "cli", system: true }),
    ).toEqual([]);
  });
});

describe("VAPID keys", () => {
  test("are made once, kept readable only by the developer, and the same on the next start", () => {
    const dir = mkdtempSync(join(tmpdir(), "octo-vapid-"));
    dirs.push(dir);
    const path = join(dir, "vapid.json");
    const first = loadOrCreateVapid(path);
    expect(first.publicKey.length).toBeGreaterThan(40);
    expect(statSync(path).mode & 0o777).toBe(0o600);
    expect(loadOrCreateVapid(path)).toEqual(first);
  });
});
