import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

const MAIN = join(import.meta.dir, "../src/main.ts");
const home = mkdtempSync(join(tmpdir(), "octo-e2e-"));
const port = 20000 + Math.floor(Math.random() * 20000);

interface Result {
  code: number;
  stdout: string;
  stderr: string;
}

function env(agent: string): Record<string, string> {
  return {
    PATH: process.env.PATH ?? "",
    OCTO_HOME: home,
    OCTO_URL: `http://127.0.0.1:${port}`,
    OCTO_PR_SYNC_SECONDS: "0",
    OCTO_AGENT: agent,
  };
}

function start(args: readonly string[], agent = "agent-a", stdin?: string) {
  return Bun.spawn(["bun", MAIN, ...args], {
    env: env(agent),
    stdin: stdin === undefined ? "ignore" : new Response(stdin),
    stdout: "pipe",
    stderr: "pipe",
  });
}

async function finish(proc: ReturnType<typeof start>): Promise<Result> {
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { code, stdout, stderr };
}

function octo(args: readonly string[], agent = "agent-a", stdin?: string): Promise<Result> {
  return finish(start(args, agent, stdin));
}

function parseJson(text: string): unknown {
  const parsed: unknown = JSON.parse(text);
  return parsed;
}

async function data<S extends z.ZodType>(
  schema: S,
  args: readonly string[],
  agent?: string,
  stdin?: string,
): Promise<z.output<S>> {
  const result = await octo(args, agent, stdin);
  if (result.code !== 0) throw new Error(`octo ${args.join(" ")} failed: ${result.stdout}${result.stderr}`);
  return schema.parse(z.object({ data: z.unknown() }).parse(parseJson(result.stdout)).data);
}

const WithRef = z.object({ ref: z.string() });
const Fired = z.object({ fired: z.boolean() });

async function serverPid(): Promise<number> {
  const response = await fetch(`http://127.0.0.1:${port}/api/health`);
  return z.object({ pid: z.number() }).parse(await response.json()).pid;
}

beforeAll(async () => {
  const result = await octo(["project", "create", "OCT", "Octotrack"]);
  expect(result.code).toBe(0);
});

afterAll(async () => {
  process.kill(await serverPid(), "SIGTERM");
  rmSync(home, { recursive: true, force: true });
});

describe("the server", () => {
  test("started by itself on the first command, which was project create", async () => {
    expect(await serverPid()).toBeGreaterThan(0);
    const status = await octo(["server", "status", "--text"]);
    expect(status.stdout).toContain("Up at");
  });
});

describe("output", () => {
  test("global flags work before the command too", async () => {
    const result = await octo(["--text", "--agent", "someone", "project", "list"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Octotrack");
    expect(result.stdout).not.toContain("{");
  });

  test("is JSON when piped, text on request", async () => {
    const piped = await octo(["project", "list"]);
    expect(z.object({ ok: z.literal(true) }).safeParse(parseJson(piped.stdout)).success).toBe(true);
    const text = await octo(["project", "list", "--text"]);
    expect(text.stdout).toContain("Octotrack");
    expect(text.stdout).not.toContain("{");
  });

  test("errors are structured, with a hint, and a useful exit code", async () => {
    const missing = await octo(["show", "OCT-404"]);
    expect(missing.code).toBe(1);
    expect(parseJson(missing.stdout)).toMatchObject({ ok: false, error: { code: "not_found" } });

    const usage = await octo(["issue", "create", "No project"]);
    expect(usage.code).toBe(2);

    const unknown = await octo(["frobnicate"]);
    expect(unknown.code).toBe(2);

    const badFlag = await octo(["issue", "list", "--nope"]);
    expect(badFlag.code).toBe(2);

    const badQuery = await octo(["feed", "nope:1"]);
    expect(badQuery.code).toBe(1);
    expect(parseJson(badQuery.stdout)).toMatchObject({ error: { code: "invalid_query" } });
  });

  test("every level has help", async () => {
    expect((await octo(["--help"])).stdout).toContain("octo guide");
    expect((await octo(["decision", "--help"])).stdout).toContain("decision resolve");
    expect((await octo(["watch", "--help"])).stdout).toContain("--until-none");
    expect((await octo(["guide"])).stdout).toContain("## Drift");
  });

  test("ops lists and describes every operation", async () => {
    const ops = await data(z.array(z.object({ name: z.string() })), ["ops"]);
    expect(ops.map((op) => op.name)).toContain("decision.resolve_batch");
    const detail = await octo(["ops", "decision.resolve"]);
    expect(detail.stdout).toContain("channel");
  });
});

describe("the whole flow an agent goes through", () => {
  test("ask a decision, hang, get unblocked by another process, clear the drift it leaves", async () => {
    const issue = await data(
      WithRef,
      ["issue", "create", "Add a queue", "-p", "OCT", "--priority", "high"],
      "agent-a",
    );
    expect(issue.ref).toMatch(/^OCT-\d+$/);

    const asking = start(
      [
        "decision",
        "ask",
        "Which queue?",
        "-p",
        "OCT",
        "--kind",
        "architecture",
        "-o",
        "sqs=SQS::Managed",
        "-o",
        "redis=Redis",
        "--recommend",
        "redis",
        "--blocks",
        issue.ref,
        "--wait",
      ],
      "agent-a",
    );

    const findQueued = async () => {
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline) {
        const queue = await data(z.array(z.object({ decision: WithRef, waiters: z.array(z.string()) })), [
          "decision",
          "queue",
        ]);
        const card = queue.find((item) => item.waiters.includes("agent-a"));
        if (card !== undefined) return card;
        await Bun.sleep(50);
      }
      throw new Error("The decision never showed up as waited on");
    };
    const card = await findQueued();
    expect(asking.exitCode).toBeNull();

    const blocked = await data(z.array(z.object({ issue: WithRef })), ["issue", "list", "blocked:true"]);
    expect(blocked.map((item) => item.issue.ref)).toContain(issue.ref);

    const resolved = await octo(
      ["decision", "resolve", card.decision.ref, "redis", "-n", "Already deployed"],
      "dev",
    );
    expect(resolved.code).toBe(0);

    const answered = await finish(asking);
    expect(answered.code).toBe(0);
    expect(parseJson(answered.stdout)).toMatchObject({
      data: {
        fired: true,
        decisions: [{ ref: card.decision.ref, chosenOption: "redis", resolutionNote: "Already deployed" }],
      },
    });

    const drift = z.object({ driftOpened: z.array(z.object({ rule: z.string(), target: z.string() })) });
    expect(
      drift
        .parse(parseJson(resolved.stdout))
        .driftOpened.map((item) => item.target)
        .sort(),
    ).toEqual([issue.ref, "OCT"].sort());

    const next = await data(z.object({ summary: z.string(), drift: z.array(WithRef) }), ["next"]);
    expect(next.summary).toContain("decisions came back");
    expect(next.drift.length).toBeGreaterThan(0);

    const refused = await octo(["drift", "ack", "--target", "OCT", "--updated", "did it"]);
    expect(refused.code).toBe(1);
    expect(refused.stdout).toContain("has not changed");

    expect(
      (await octo(["drift", "ack", "--target", issue.ref, "--verified", "Issue never named a queue"])).code,
    ).toBe(0);
    expect((await octo(["drift", "ack", "--target", "OCT", "--verified", "Nothing to change"])).code).toBe(0);
    expect(await data(z.array(WithRef), ["drift", "list", "target:OCT"])).toEqual([]);
  }, 20000);
});

describe("watch", () => {
  test("hangs on an event, exits 0 when it happens", async () => {
    const watching = start([
      "watch",
      "--on",
      "event:status.posted label:nothing OR level:blocker",
      "--timeout",
      "10s",
    ]);
    await Bun.sleep(400);
    expect(watching.exitCode).toBeNull();
    await octo(["post", "Not this one", "-p", "OCT", "--level", "info"]);
    await Bun.sleep(200);
    expect(watching.exitCode).toBeNull();
    await octo(["post", "This one", "-p", "OCT", "--level", "blocker"]);
    const result = await finish(watching);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("This one");
  }, 15000);

  test("a state clause returns at once when already true, without hanging", async () => {
    const decision = await data(WithRef, ["decision", "ask", "Quick?"]);
    await octo(["decision", "resolve", decision.ref, "-n", "Yes"]);
    const started = Date.now();
    const result = await octo(["watch", "--until", `ref:${decision.ref} status:decided`, "--timeout", "10s"]);
    expect(result.code).toBe(0);
    expect(Date.now() - started).toBeLessThan(3000);
    expect(Fired.parse(z.object({ data: Fired }).parse(parseJson(result.stdout)).data).fired).toBe(true);
  });

  test("times out with exit 124 and cancels its watch", async () => {
    const before = await data(z.array(WithRef), ["watch", "list", "--all"]);
    const result = await octo(["watch", "--on", '"text that nothing contains"', "--timeout", "300ms"]);
    expect(result.code).toBe(124);
    expect(parseJson(result.stdout)).toMatchObject({ data: { fired: false, reason: "timeout" } });
    const active = await data(z.array(WithRef), ["watch", "list"]);
    const newest = (await data(z.array(WithRef), ["watch", "list", "--all"])).filter(
      (watch) => !before.some((item) => item.ref === watch.ref),
    );
    expect(newest).toHaveLength(1);
    expect(active.map((watch) => watch.ref)).not.toContain(newest[0]?.ref);
  });

  test("Ctrl-C cancels the watch rather than leaving it behind", async () => {
    const watching = start(["watch", "--on", '"text that nothing contains"']);
    await Bun.sleep(500);
    const active = await data(z.array(WithRef), ["watch", "list", "--agent", "agent-a"]);
    expect(active.length).toBeGreaterThan(0);
    watching.kill("SIGINT");
    expect(await watching.exited).toBe(130);
    expect(await data(z.array(WithRef), ["watch", "list", "--agent", "agent-a"])).toEqual([]);
  }, 10000);

  test("wait uses plain statuses, and refuses refs that do not exist", async () => {
    const issue = await data(WithRef, ["issue", "create", "Waited on", "-p", "OCT"]);
    const waiting = start(["wait", issue.ref, "--status", "done", "--timeout", "10s"]);
    await Bun.sleep(400);
    expect(waiting.exitCode).toBeNull();
    await octo(["issue", "update", issue.ref, "--status", "in_progress"]);
    await Bun.sleep(200);
    expect(waiting.exitCode).toBeNull();
    await octo(["issue", "close", issue.ref]);
    expect((await finish(waiting)).code).toBe(0);

    const missing = await octo(["wait", "D-9999", "--timeout", "1s"]);
    expect(missing.code).toBe(1);
    expect(missing.stdout).toContain("D-9999");
  }, 15000);

  test("one agent keeps several watches in flight and collects them later", async () => {
    const first = await data(WithRef, ["decision", "ask", "First"], "juggler");
    const second = await data(WithRef, ["decision", "ask", "Second"], "juggler");
    await data(
      WithRef,
      ["watch", "start", "--name", "one", "--until", `ref:${first.ref} status:decided`],
      "juggler",
    );
    await data(
      WithRef,
      ["watch", "start", "--name", "two", "--until", `ref:${second.ref} status:decided`],
      "juggler",
    );

    const Results = z.array(z.object({ name: z.string().nullable(), fired: z.boolean() }));
    const quiet = await data(Results, ["watch", "check"], "juggler");
    expect(quiet.map((item) => item.fired)).toEqual([false, false]);

    await octo(["decision", "resolve", second.ref, "-n", "Yes"], "dev");
    const partial = await data(Results, ["watch", "check"], "juggler");
    expect(partial.find((item) => item.name === "two")?.fired).toBe(true);
    expect(partial.find((item) => item.name === "one")?.fired).toBe(false);

    const hanging = start(["watch", "wait", "one", "--timeout", "10s"], "juggler");
    await Bun.sleep(300);
    expect(hanging.exitCode).toBeNull();
    await octo(["decision", "resolve", first.ref, "-n", "Yes"], "dev");
    expect((await finish(hanging)).code).toBe(0);
  }, 15000);

  test("feed --follow streams matching events as lines", async () => {
    const following = start(["feed", "-f", "level:progress", "--timeout", "2s"]);
    await Bun.sleep(400);
    await octo(["post", "Step one", "-p", "OCT", "--level", "progress"]);
    await octo(["post", "Ignored", "-p", "OCT", "--level", "info"]);
    await octo(["post", "Step two", "-p", "OCT", "--level", "progress"]);
    const result = await finish(following);
    const summaries = result.stdout
      .trim()
      .split("\n")
      .map((line) => z.object({ summary: z.string() }).parse(parseJson(line)).summary);
    expect(summaries).toEqual(["Step one", "Step two"]);
  }, 10000);

  test("a waiting agent survives the server dying twice, with nobody else around to restart it", async () => {
    const decision = await data(WithRef, ["decision", "ask", "Across two restarts"]);
    const waiting = start(["watch", "--until", `ref:${decision.ref} status:decided`, "--timeout", "40s"]);
    await Bun.sleep(400);

    const upAgain = async (previous: number): Promise<number> => {
      const deadline = Date.now() + 15000;
      while (Date.now() < deadline) {
        try {
          const pid = await serverPid();
          if (pid !== previous) return pid;
        } catch {
          // Still down.
        }
        await Bun.sleep(100);
      }
      throw new Error("The waiter did not bring the server back");
    };

    const first = await serverPid();
    process.kill(first, "SIGTERM");
    const second = await upAgain(first);
    // Long enough for the waiter's previous start attempt to count as over.
    await Bun.sleep(5500);
    process.kill(second, "SIGTERM");
    await upAgain(second);

    expect(waiting.exitCode).toBeNull();
    expect((await octo(["decision", "resolve", decision.ref, "-n", "Yes"], "dev")).code).toBe(0);
    expect((await finish(waiting)).code).toBe(0);
  }, 45000);

  test("server stop stays stopped while an agent waits, and a real command starts it again", async () => {
    const decision = await data(WithRef, ["decision", "ask", "Across a stop"]);
    const waiting = start(["watch", "--until", `ref:${decision.ref} status:decided`, "--timeout", "30s"]);
    await Bun.sleep(400);
    expect((await octo(["server", "stop"])).code).toBe(0);
    await Bun.sleep(3000);
    let up = true;
    try {
      await serverPid();
    } catch {
      up = false;
    }
    expect(up).toBe(false);
    expect(waiting.exitCode).toBeNull();

    expect((await octo(["decision", "resolve", decision.ref, "-n", "Yes"], "dev")).code).toBe(0);
    expect((await finish(waiting)).code).toBe(0);
  }, 45000);

  test("a waiting agent survives the server restarting", async () => {
    const decision = await data(WithRef, ["decision", "ask", "Across a restart"]);
    const waiting = start(["watch", "--until", `ref:${decision.ref} status:decided`, "--timeout", "15s"]);
    await Bun.sleep(400);
    process.kill(await serverPid(), "SIGTERM");
    await Bun.sleep(300);
    expect(waiting.exitCode).toBeNull();

    // Any command starts the server again, and the data is still there.
    expect((await octo(["decision", "resolve", decision.ref, "-n", "Yes"], "dev")).code).toBe(0);
    expect((await finish(waiting)).code).toBe(0);
  }, 20000);
});

describe("what the audit found", () => {
  test("negated queries work as documented, and option values can start with a dash", async () => {
    expect((await octo(["find", "-kind:drift", "--limit", "1"])).code).toBe(0);
    expect((await octo(["issue", "list", "-assignee:none"])).code).toBe(0);
    expect((await octo(["feed", "-actor:nobody", "--limit", "1"])).code).toBe(0);
    const note = await octo(["post", "A status", "-p", "OCT"]);
    expect(note.code).toBe(0);
    const dashed = await octo(["idea", "add", "-1 is the wrong index", "--body", "-starts with a dash"]);
    expect(dashed.code).toBe(2);
    const body = await data(z.object({ body: z.string() }), [
      "idea",
      "add",
      "Dash body",
      "--body",
      "-starts with a dash",
    ]);
    expect(body.body).toBe("-starts with a dash");
  });

  test("a typo in a watch is an error at once, not a success and not a hang", async () => {
    const decision = await data(WithRef, ["decision", "ask", "Typo check"]);
    for (const clause of [
      ["--until-none", `ref:${decision.ref} status:opne`],
      ["--until-none", "project:NOPE status:open"],
      ["--on", "since:garbage"],
    ]) {
      const result = await octo(["watch", ...clause, "--timeout", "2s"]);
      expect(result.code).toBe(1);
    }
  });

  test("a PR can be waited on by its GitHub name", async () => {
    await octo(["pr", "upsert", "Acme/Waited#3", "Waited on"]);
    const waiting = start(["wait", "Acme/Waited#3", "--status", "merged", "--timeout", "10s"]);
    await Bun.sleep(400);
    expect(waiting.exitCode).toBeNull();
    await octo(["pr", "upsert", "Acme/Waited#3", "Waited on", "--state", "merged"]);
    expect((await finish(waiting)).code).toBe(0);
  }, 15000);

  test("--timeout 0 checks once and answers honestly", async () => {
    const decision = await data(WithRef, ["decision", "ask", "Zero timeout"]);
    const open = await octo(["watch", "--until", `ref:${decision.ref} status:decided`, "--timeout", "0"]);
    expect(open.code).toBe(124);
    await octo(["decision", "resolve", decision.ref, "-n", "Yes"], "dev");
    const decided = await octo(["watch", "--until", `ref:${decision.ref} status:decided`, "--timeout", "0"]);
    expect(decided.code).toBe(0);
  });

  test("feed --follow respects a view, and prints an event once even if two clauses match it", async () => {
    await octo(["view", "save", "Progress", "level:progress"]);
    const viewed = start(["feed", "-f", "--view", "Progress", "--timeout", "1500ms"]);
    await Bun.sleep(400);
    await octo(["post", "Wrong level", "-p", "OCT", "--level", "info"]);
    await octo(["post", "Right level", "-p", "OCT", "--level", "progress"]);
    const lines = (await finish(viewed)).stdout.trim().split("\n");
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("Right level");

    const both = start([
      "watch",
      "-f",
      "--on",
      "level:warning",
      "--on",
      "kind:update",
      "--timeout",
      "1500ms",
    ]);
    await Bun.sleep(400);
    await octo(["post", "Matches both", "-p", "OCT", "--level", "warning"]);
    expect((await finish(both)).stdout.trim().split("\n")).toHaveLength(1);
  }, 15000);

  test("the agent waiting on a decision is told what it must now re-check", async () => {
    const issue = await data(WithRef, ["issue", "create", "Depends on the answer", "-p", "OCT"]);
    const waiting = start(
      [
        "decision",
        "ask",
        "Told about drift",
        "-p",
        "OCT",
        "--affects",
        issue.ref,
        "--wait",
        "--timeout",
        "10s",
      ],
      "asker",
    );
    const deadline = Date.now() + 5000;
    let ref: string | undefined;
    while (ref === undefined && Date.now() < deadline) {
      const list = await data(z.array(z.object({ ref: z.string(), title: z.string() })), [
        "decision",
        "list",
        "status:open",
      ]);
      ref = list.find((item) => item.title === "Told about drift")?.ref;
      if (ref === undefined) await Bun.sleep(50);
    }
    await octo(["decision", "resolve", ref ?? "", "-n", "Yes"], "dev");
    const result = await finish(waiting);
    const targets = z
      .object({ data: z.object({ driftToClear: z.array(z.object({ target: z.string() })) }) })
      .parse(parseJson(result.stdout))
      .data.driftToClear.map((item) => item.target);
    expect(targets.sort()).toEqual([issue.ref, "OCT"].sort());
  }, 15000);

  test("partial failures say so at the top level", async () => {
    const asked = await data(WithRef, ["decision", "ask", "Partial", "-o", "x=X"]);
    const result = await octo(["decision", "batch"], "dev", `${asked.ref} nope\n`);
    expect(result.code).toBe(1);
    expect(parseJson(result.stdout)).toMatchObject({ ok: false });
  });

  test("agent names can be any language", async () => {
    const result = await octo(["post", "From a name with an accent", "-p", "OCT"], "agénte-日本");
    expect(result.code).toBe(0);
    expect((await octo(["agent", "list", "--text"])).stdout).toContain("agénte-日本");
  });

  test("a gh that hangs is given up on instead of blocking every later sync", async () => {
    const bin = join(home, "slow-bin");
    mkdirSync(bin, { recursive: true });
    writeFileSync(join(bin, "gh"), "#!/bin/sh\nexec sleep 30\n", { mode: 0o755 });
    const proc = Bun.spawn(["bun", MAIN, "pr", "sync", "--repo", "acme/slow"], {
      env: { ...env("agent-a"), PATH: `${bin}:${process.env.PATH ?? ""}`, OCTO_GH_TIMEOUT_MS: "200" },
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
    });
    const started = Date.now();
    const result = await finish(proc);
    expect(result.code).toBe(1);
    expect(result.stdout).toContain("did not answer");
    expect(Date.now() - started).toBeLessThan(5000);
    const status = await octo(["status", "--text"]);
    expect(status.stdout).toContain("PR status is stale for acme/slow");
    await octo(["op", "pr.sync", "--input", JSON.stringify({ prs: [], repos: ["acme/slow"] })]);
  }, 15000);
});

describe("several things at once", () => {
  test("batch is atomic and links results with aliases", async () => {
    const ops = JSON.stringify([
      { op: "issue.create", as: "a", input: { project: "OCT", title: "Batch A" } },
      { op: "issue.create", as: "b", input: { project: "OCT", title: "Batch B", blockedBy: ["$a.ref"] } },
      { op: "update.post", input: { body: "Split", target: "$b.ref" } },
    ]);
    const result = await octo(["batch"], "agent-a", ops);
    expect(result.code).toBe(0);
    expect(parseJson(result.stdout)).toMatchObject({ ok: true });

    const bad = await octo(
      ["batch"],
      "agent-a",
      JSON.stringify([
        { op: "issue.create", input: { project: "OCT", title: "Rolled back" } },
        { op: "issue.create", input: { project: "NOPE", title: "Fails" } },
      ]),
    );
    expect(bad.code).toBe(1);
    expect(parseJson(bad.stdout)).toMatchObject({ ok: false });
    expect(await data(z.array(WithRef), ["find", '"Rolled back"'])).toEqual([]);
  });

  test("batch accepts one JSON op per line, and keep-going keeps what worked", async () => {
    const lines = [
      JSON.stringify({ op: "idea.capture", input: { title: "Kept idea" } }),
      JSON.stringify({ op: "nope.nope" }),
    ].join("\n");
    const result = await octo(["batch", "--keep-going"], "agent-a", lines);
    expect(result.code).toBe(1);
    expect((await data(z.array(WithRef), ["find", '"Kept idea"'])).length).toBe(1);
  });

  test("bulk arguments and competing claims", async () => {
    const one = await data(WithRef, ["issue", "create", "Bulk one", "-p", "OCT"]);
    const two = await data(WithRef, ["issue", "create", "Bulk two", "-p", "OCT"]);
    const updated = await data(z.array(z.object({ priority: z.string() })), [
      "issue",
      "update",
      one.ref,
      two.ref,
      "--priority",
      "urgent",
    ]);
    expect(updated.map((item) => item.priority)).toEqual(["urgent", "urgent"]);

    const claims = await Promise.all(
      ["racer-1", "racer-2", "racer-3"].map((agent) => octo(["issue", "claim", one.ref], agent)),
    );
    expect(claims.filter((claim) => claim.code === 0)).toHaveLength(1);
    expect(claims.filter((claim) => claim.code === 1)).toHaveLength(2);
  });

  test("ten agents writing concurrently all land", async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        octo(["issue", "create", `Concurrent ${index}`, "-p", "OCT"], `agent-${index}`),
      ),
    );
    expect(results.every((result) => result.code === 0)).toBe(true);
    const refs = results.map(
      (result) => z.object({ data: WithRef }).parse(parseJson(result.stdout)).data.ref,
    );
    expect(new Set(refs).size).toBe(10);
  }, 15000);
});

describe("pr sync through gh", () => {
  test("maps real gh output, links issues by mention, and one bad repo does not stop the others", async () => {
    const issue = await data(WithRef, ["issue", "create", "Sync target", "-p", "OCT"]);
    const bin = join(home, "bin");
    mkdirSync(bin, { recursive: true });
    const pr = {
      number: 5,
      title: `${issue.ref}: from gh`,
      body: null,
      url: "https://github.com/acme/good/pull/5",
      state: "OPEN",
      isDraft: false,
      headRefName: "feature/x",
      baseRefName: "main",
      headRefOid: "abc123",
      author: { login: "someone" },
      additions: 3,
      deletions: 1,
      reviewDecision: "CHANGES_REQUESTED",
      mergeable: "CONFLICTING",
      mergedAt: null,
      closedAt: null,
      updatedAt: "2026-11-07T00:00:00Z",
      statusCheckRollup: [{ status: "COMPLETED", conclusion: "FAILURE" }],
    };
    const gone = {
      ...pr,
      number: 9,
      title: "Merged while asleep",
      state: "MERGED",
      mergedAt: "2026-11-07T01:00:00Z",
    };
    const script = `#!/bin/sh
case "$*" in
  "pr view 9"*) printf '%s' '${JSON.stringify(gone)}' ;;
  *acme/good*"--state open"*) printf '%s' '${JSON.stringify([pr])}' ;;
  *acme/good*) printf '[]' ;;
  *) echo "no such repo" >&2; exit 1 ;;
esac
`;
    writeFileSync(join(bin, "gh"), script, { mode: 0o755 });
    await octo(["pr", "upsert", "acme/good#9", "Still open as far as we know"]);
    const proc = Bun.spawn(["bun", MAIN, "pr", "sync", "--repo", "acme/good", "--repo", "acme/missing"], {
      env: { ...env("agent-a"), PATH: `${bin}:${process.env.PATH ?? ""}` },
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
    });
    const result = await finish(proc);
    expect(result.code).toBe(1);
    expect(parseJson(result.stdout)).toMatchObject({
      data: { synced: 2, errors: [expect.stringContaining("acme/missing")] },
    });

    const shown = await data(
      z.object({
        entity: z.object({
          checks: z.string(),
          review: z.string(),
          mergeable: z.string(),
          author: z.string(),
        }),
        links: z.array(z.object({ toRef: z.string() })),
      }),
      ["show", "acme/good#5"],
    );
    expect(shown.entity).toEqual({
      checks: "failing",
      review: "changes_requested",
      mergeable: "conflicting",
      author: "someone",
    });
    expect(shown.links.map((link) => link.toRef)).toEqual([issue.ref]);

    const refreshed = await data(z.object({ entity: z.object({ state: z.string() }) }), [
      "show",
      "acme/good#9",
    ]);
    expect(refreshed.entity.state).toBe("merged");
  }, 15000);
});

describe("decisions out of band", () => {
  test("logged in bulk from lines on stdin", async () => {
    const asked = await data(WithRef, ["decision", "ask", "Bulk A", "-o", "x=X", "-o", "y=Y"]);
    const other = await data(WithRef, ["decision", "ask", "Bulk B", "-o", "x=X"]);
    const result = await octo(
      ["decision", "batch"],
      "dev",
      `${asked.ref} y Agreed on the call\n${other.ref} nope\n`,
    );
    expect(result.code).toBe(1);
    expect(parseJson(result.stdout)).toMatchObject({
      data: {
        results: [
          {
            ref: asked.ref,
            ok: true,
            decision: { channel: "out_of_band", chosenOption: "y", decidedBy: "dev" },
          },
          { ref: other.ref, ok: false },
        ],
      },
    });
  });

  test("logged in bulk from a JSON file", async () => {
    const asked = await data(WithRef, ["decision", "ask", "File A"]);
    const file = join(home, "outcomes.json");
    writeFileSync(file, JSON.stringify([{ ref: asked.ref, note: "From the file" }]));
    const result = await octo(["decision", "batch", "-f", file], "dev");
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("From the file");
  });

  test("recorded after the fact, with when and where", async () => {
    const recorded = await data(
      z.object({ status: z.string(), channel: z.string(), decidedAt: z.string(), sourceUrl: z.string() }),
      [
        "decision",
        "record",
        "Use SQLite",
        "--chosen",
        "SQLite",
        "--at",
        "2026-11-01T09:00:00.000Z",
        "--source",
        "https://example.com/n",
      ],
    );
    expect(recorded).toEqual({
      status: "decided",
      channel: "out_of_band",
      decidedAt: "2026-11-01T09:00:00.000Z",
      sourceUrl: "https://example.com/n",
    });
  });
});

describe("everything else, through the CLI", () => {
  test("prs, ideas, milestones, links, views, roadmap and show all work", async () => {
    await octo(["project", "create", "WEB", "Website", "--repo", "acme/web"]);
    const issue = await data(WithRef, ["issue", "create", "Landing page", "-p", "WEB"]);
    const pr = await data(WithRef, [
      "pr",
      "upsert",
      "acme/web#7",
      `${issue.ref}: landing`,
      "--checks",
      "failing",
      "--sha",
      "abc",
    ]);
    expect(
      (
        await data(z.array(z.object({ attention: z.array(z.string()) })), [
          "pr",
          "list",
          "--checks",
          "failing",
        ])
      )[0]?.attention,
    ).toContain("checks failing");
    expect((await octo(["show", "acme/web#7", "--text"])).stdout).toContain(issue.ref);

    const milestone = await data(WithRef, [
      "milestone",
      "create",
      "Launch",
      "-p",
      "WEB",
      "--status",
      "active",
    ]);
    await octo(["issue", "update", issue.ref, "-m", milestone.ref]);

    const idea = await data(WithRef, ["idea", "add", "Newsletter", "-p", "WEB", "--horizon", "next"]);
    const roadmap = await octo(["roadmap", "-p", "WEB", "--text"]);
    expect(roadmap.stdout).toContain("Launch");
    expect(roadmap.stdout).toContain("Newsletter");
    const roadmapFile = join(home, "ROADMAP.md");
    await octo(["roadmap", "--write", roadmapFile]);
    expect(await Bun.file(roadmapFile).text()).toContain("# Roadmap");

    const promoted = await data(z.object({ created: z.string() }), ["idea", "promote", idea.ref]);
    expect(promoted.created).toMatch(/^WEB-/);

    const other = await data(WithRef, ["issue", "create", "Depends", "-p", "WEB"]);
    await octo(["link", "add", other.ref, "depends-on", issue.ref]);
    const links = await data(z.array(z.object({ fromRef: z.string(), rel: z.string(), toRef: z.string() })), [
      "link",
      "list",
      other.ref,
    ]);
    expect(links).toContainEqual(
      expect.objectContaining({ fromRef: issue.ref, rel: "blocks", toRef: other.ref }),
    );
    const graph = await data(z.object({ nodes: z.array(WithRef) }), ["link", "graph", other.ref]);
    expect(graph.nodes.map((node) => node.ref)).toContain(pr.ref);
    await octo(["link", "rm", other.ref, "depends-on", issue.ref]);
    expect(await data(z.array(WithRef), ["find", `linked:${other.ref}`])).toEqual([]);

    await octo(["view", "save", "Mine", "project:WEB"]);
    expect(
      (await data(z.object({ events: z.array(WithRef) }), ["feed", "--view", "Mine", "--limit", "3"])).events,
    ).toHaveLength(3);
    await octo(["view", "rm", "Mine"]);

    await octo(["agent", "note", "Working on the site"], "web-agent");
    expect((await octo(["agent", "list", "--text"])).stdout).toContain("Working on the site");

    expect((await octo(["status", "--text"])).stdout).toContain("Decisions");
    expect((await octo(["fields"])).stdout).toContain("linked");
    expect((await octo(["updates", "project:OCT", "--limit", "1"])).code).toBe(0);
    expect((await octo(["drift", "scan"])).code).toBe(0);
  }, 30000);

  test("raw op reaches anything, with input as a flag or on stdin", async () => {
    const flag = await octo(["op", "idea.capture", "--input", '{"title":"From a flag"}']);
    expect(flag.code).toBe(0);
    const piped = await octo(["op", "idea.capture"], "agent-a", '{"title":"From stdin"}');
    expect(piped.code).toBe(0);
    expect(piped.stdout).toContain("From stdin");
  });

  test("demo data refuses to mix with real data", async () => {
    const result = await octo(["seed", "demo"]);
    expect(result.code).toBe(1);
    expect(result.stdout).toContain("already has projects");
  });
});
