import { type Contract, contracts, type ErrorBody, OpEnvelope } from "@octotrack/core/contracts";
import type { Bootstrap } from "@octotrack/core/schemas";
import type { z } from "zod";

export class ApiError extends Error {
  readonly code: string;
  readonly hint: string | null;

  constructor(body: ErrorBody) {
    super(body.message);
    this.code = body.code;
    this.hint = body.hint;
  }
}

function unwrap(body: unknown): unknown {
  const envelope = OpEnvelope.parse(body);
  if (!envelope.ok) throw new ApiError(envelope.error);
  return envelope.data;
}

/** Runs an operation and validates the response against its contract. */
export async function callOp<I extends z.ZodType, O extends z.ZodType>(
  contract: Contract<I, O>,
  input: z.input<I>,
): Promise<z.output<O>> {
  const response = await fetch(`/api/ops/${contract.name}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-octo-channel": "dashboard" },
    body: JSON.stringify({ input }),
  });
  return contract.output.parse(unwrap(await response.json()));
}

export async function fetchBootstrap(): Promise<Bootstrap> {
  const response = await fetch("/api/bootstrap");
  return contracts.dashboardBootstrap.output.parse(unwrap(await response.json()));
}

export async function syncGithub(): Promise<void> {
  const response = await fetch("/api/github/sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  unwrap(await response.json());
}
