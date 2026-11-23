import { contracts as c } from "@octotrack/core";
import { OctoClient } from "./client.ts";

/**
 * Made-up data that exercises every part of the dashboard: lines in the developer's order, agents on them, questions,
 * a task, failing PRs, drift and proposals.
 * Goes through the normal operations under several agent names, as real work would.
 */
export async function seedDemo(
  base: OctoClient,
): Promise<{ decisions: number; issues: number; prs: number }> {
  const as = (agent: string) => new OctoClient(base.baseUrl, agent, [], false);
  const planner = as("planner");
  const api = as("api-agent");
  const web = as("web-agent");
  const infra = as("codex-infra");
  const you = new OctoClient(base.baseUrl, "dev", [], false, { developer: true });

  await planner.call(c.projectCreate, {
    key: "SHOP",
    name: "Storefront rewrite",
    description: "Move checkout and catalog to the new stack.",
    repo: "acme/storefront",
  });
  await planner.call(c.projectCreate, {
    key: "API",
    name: "Public API v2",
    description: "Versioned, documented, rate limited.",
    repo: "acme/api",
    horizon: "now",
  });
  await planner.call(c.projectCreate, {
    key: "OPS",
    name: "Observability",
    description: "Tracing and alerting across services.",
    status: "planned",
    horizon: "later",
  });

  const beta = await you.call(c.lineAdd, {
    title: "Checkout beta",
    doneWhen: "Invited customers can pay, with tax, from a cart that survives a refresh.",
    repos: ["SHOP"],
    where: "working",
  });
  await you.call(c.lineAdd, {
    title: "v2 general availability",
    doneWhen: "Every v2 endpoint is authenticated, rate limited and documented.",
    repos: ["API"],
    where: "working",
  });
  await you.call(c.lineAdd, {
    title: "Catalog migration",
    doneWhen: "The catalog is served from the new stack and the old one is off.",
    repos: ["SHOP"],
    where: "up_next",
  });
  await you.call(c.lineAdd, {
    title: "Observability",
    doneWhen: "Every request carries a trace ID from the edge to the database.",
    repos: ["OPS"],
    where: "tabled",
    reason: "Not until the beta ships",
    lookAgainAt: "2027-01-10",
  });
  await you.call(c.placeAdd, { name: "the Mac" });
  for (const [agent, repo] of [
    [web, "SHOP"],
    [api, "API"],
  ] as const) {
    await agent.call(c.agentRegister, { repo });
    await agent.call(c.lineTake, {});
  }
  await web.call(c.planSet, {
    line: beta.data.ref,
    steps: ["Cart and checkout form", "Payments and tax", "Invite list and launch"],
  });

  const issue = async (
    client: OctoClient,
    project: string,
    title: string,
    extra: Record<string, unknown> = {},
  ): Promise<string> => (await client.call(c.issueCreate, { project, title, ...extra })).data.ref;

  const payments = await issue(planner, "SHOP", "Payment provider integration", {
    priority: "urgent",
    line: beta.data.ref,
    labels: ["payments"],
    body: "Blocked until the provider is chosen.",
  });
  const cart = await issue(web, "SHOP", "Cart state survives a refresh", {
    status: "in_progress",
    assignee: "web-agent",
    line: beta.data.ref,
    labels: ["frontend"],
  });
  const taxes = await issue(planner, "SHOP", "Tax calculation by region", {
    line: beta.data.ref,
    priority: "high",
  });
  const checkoutUi = await issue(web, "SHOP", "Checkout form validation", {
    status: "done",
    assignee: "web-agent",
    line: beta.data.ref,
    labels: ["frontend"],
  });
  const auth = await issue(api, "API", "Token based authentication", {
    status: "in_review",
    assignee: "api-agent",
    priority: "high",
  });
  await issue(api, "API", "Rate limiting per client", { priority: "high", blockedBy: [auth] });
  const docs = await issue(api, "API", "Generate reference docs", { derivedFrom: [auth], priority: "low" });
  const versioning = await issue(api, "API", "URL versus header versioning", {
    status: "blocked",
    priority: "medium",
  });
  await issue(infra, "OPS", "Trace IDs in every log line", { status: "backlog", priority: "low" });

  const provider = await planner.call(c.decisionAsk, {
    title: "Which payment provider for launch?",
    project: "SHOP",
    kind: "product",
    priority: "urgent",
    context:
      "The beta needs one provider. Fees differ by about 0.4 percent, and one of them already passed the security review.",
    options: [
      { key: "stripe", label: "Stripe", description: "Passed security review, higher fees" },
      { key: "adyen", label: "Adyen", description: "Lower fees, four weeks of review still to do" },
    ],
    recommendation: "stripe",
    why: "It already passed the security review, so the beta is not held up four weeks for a smaller fee.",
    blocks: [payments, taxes],
  });
  await api.call(c.decisionAsk, {
    title: "URL or header versioning for API v2?",
    project: "API",
    kind: "architecture",
    priority: "high",
    context: "Affects every client and the docs. Very hard to change after launch.",
    options: [
      { key: "url", label: "/v2/ in the URL", description: "Obvious, cacheable, slightly less pure" },
      { key: "header", label: "Accept header", description: "Clean URLs, harder for clients and proxies" },
    ],
    recommendation: "url",
    why: "Every client, cache and proxy handles a path; a header is easy to drop on the way.",
    blocks: [versioning],
    affects: [docs],
  });
  const queue = await infra.call(c.decisionAsk, {
    title: "Keep Redis or move the job queue to SQS?",
    project: "SHOP",
    kind: "architecture",
    priority: "medium",
    context: "Redis is already deployed but has lost jobs twice this year.",
    options: [
      { key: "redis", label: "Keep Redis", description: "No migration, known failure mode" },
      { key: "sqs", label: "Move to SQS", description: "About a week of work, more durable" },
    ],
    recommendation: "sqs",
    why: "Redis has lost jobs twice this year; a week of work buys a queue that does not.",
  });
  await web.call(c.decisionAsk, {
    title: "OK to drop support for Safari 15?",
    project: "SHOP",
    kind: "approval",
    priority: "low",
    context: "Under 1 percent of traffic, and it blocks using container queries.",
    options: [
      {
        key: "drop",
        label: "Drop it",
        description: "Raise the browser floor to Safari 16 and use container queries",
      },
      { key: "keep", label: "Keep it", description: "Lay the cards out with media queries a while longer" },
    ],
  });
  await planner.call(c.decisionRecord, {
    title: "SQLite for local development",
    chosen: "SQLite locally, Postgres in production",
    project: "API",
    kind: "architecture",
    decidedAt: "2026-11-03T15:00:00.000Z",
    note: "Agreed on the planning call.",
  });

  const pr = (
    client: OctoClient,
    repo: string,
    number: number,
    title: string,
    extra: Record<string, unknown> = {},
  ) =>
    client.call(c.prUpsert, {
      repo,
      number,
      title,
      state: "open",
      url: `https://github.com/${repo}/pull/${number}`,
      ...extra,
    });

  await pr(web, "acme/storefront", 482, `${cart}: keep cart in local storage`, {
    checks: "failing",
    review: "requested",
    headRef: "feature/cart-persist",
    headSha: "a1b2c3",
    author: "web-agent",
    additions: 214,
    deletions: 37,
  });
  await pr(web, "acme/storefront", 479, `${checkoutUi}: validate the checkout form`, {
    checks: "passing",
    review: "approved",
    mergeable: "clean",
    headRef: "feature/checkout-validation",
    headSha: "d4e5f6",
    author: "web-agent",
    additions: 96,
    deletions: 12,
  });
  await pr(api, "acme/api", 133, `${auth}: token authentication`, {
    checks: "passing",
    review: "changes_requested",
    mergeable: "conflicting",
    headRef: "feature/tokens",
    headSha: "778899",
    author: "api-agent",
    additions: 642,
    deletions: 81,
  });
  await pr(infra, "acme/api", 131, "Bump base image", {
    state: "draft",
    checks: "pending",
    headRef: "chore/base-image",
    headSha: "aa11bb",
    author: "codex-infra",
    additions: 2,
    deletions: 2,
  });
  await pr(api, "acme/api", 128, "Remove the v1 test harness", {
    state: "merged",
    checks: "passing",
    review: "approved",
    headRef: "chore/remove-harness",
    author: "api-agent",
    additions: 12,
    deletions: 880,
    mergedAt: "2026-11-06T18:20:00.000Z",
  });

  await web.call(c.updatePost, {
    body: "Cart persistence works, one flaky test left to chase down.",
    target: cart,
    level: "progress",
  });
  await api.call(c.updatePost, {
    body: "Review asked for token rotation. Reworking the middleware.",
    target: auth,
    level: "warning",
  });
  await planner.call(c.updatePost, {
    body: "Payments and tax are both stuck until the provider decision.",
    project: "SHOP",
    level: "blocker",
  });
  await infra.call(c.updatePost, {
    body: "Redis lost 14 jobs overnight, see the queue decision.",
    target: queue.data.ref,
    level: "warning",
  });

  await planner.call(c.linePropose, {
    title: "Apple Pay at checkout",
    doneWhen: "Apple Pay works on every checkout path, on iPhone and Mac.",
    repos: ["SHOP"],
    recommendation: "up_next",
    why: "Half of the beta's invited customers are on iPhone, and the provider supports it at no cost.",
  });
  await api.call(c.linePropose, {
    title: "Client SDKs generated from the spec",
    doneWhen: "TypeScript and Python SDKs publish on every API release.",
    repos: ["API"],
    recommendation: "table",
    why: "Nobody asked for them yet; the spec changes weekly until GA.",
  });
  await web.call(c.taskFile, {
    title: "Try checkout on your phone",
    place: "the Mac",
    outcome: "Whether the form is usable at arm's length, and anything that got in the way.",
  });

  await you.call(c.decisionRecord, {
    title: "Ship the beta behind an invite list",
    chosen: "Invite list until payments are stable",
    project: "SHOP",
    kind: "product",
    affects: [cart],
  });

  // Keep the waiting indicator honest in the demo: this watch exists but nobody is really polling it for long.
  await planner.call(c.watchCreate, {
    name: "provider",
    spec: {
      require: "any",
      clauses: [{ type: "state", query: `ref:${provider.data.ref} status:decided`, mode: "exists" }],
    },
  });

  await you.call(c.viewSave, { name: "Payments", query: 'label:payments OR "payment"' });

  return { decisions: 6, issues: 9, prs: 5 };
}
