import { z } from "zod";
import type { Contract } from "../contracts.ts";
import { OctoError } from "../errors.ts";
import type { Ctx } from "../store/context.ts";

/** One operation with its generics erased. Input is validated inside `run`, so callers can pass raw JSON. */
export interface BoundOp {
  name: string;
  summary: string;
  mutates: boolean;
  input: z.ZodType;
  output: z.ZodType;
  run(ctx: Ctx, raw: unknown): unknown;
}

export function bind<I extends z.ZodType, O extends z.ZodType>(
  contract: Contract<I, O>,
  handler: (ctx: Ctx, input: z.output<I>) => z.output<O>,
): BoundOp {
  return {
    name: contract.name,
    summary: contract.summary,
    mutates: contract.mutates,
    input: contract.input,
    output: contract.output,
    run(ctx, raw) {
      const parsed = contract.input.safeParse(raw ?? {});
      if (!parsed.success) {
        throw new OctoError(
          "invalid_input",
          `Invalid input for ${contract.name}: ${z.prettifyError(parsed.error)}`,
          `Run \`octo ops ${contract.name}\` to see the input schema.`,
        );
      }
      return handler(ctx, parsed.data);
    },
  };
}
