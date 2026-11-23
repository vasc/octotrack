import type { Contract } from "@octotrack/core/contracts";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { z } from "zod";
import { callOp } from "../api/client.ts";

/**
 * A read operation as a query. Previous data stays on screen while new data loads, so that changing a filter
 * never flashes a spinner.
 */
export function useOpQuery<I extends z.ZodType, O extends z.ZodType>(
  contract: Contract<I, O>,
  input: z.input<I>,
  options: { enabled?: boolean; initialData?: z.output<O> } = {},
) {
  return useQuery<z.output<O>>({
    queryKey: [contract.name, input],
    queryFn: () => callOp(contract, input),
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
    initialData: options.initialData,
    // Bootstrapped data is already current, so do not fetch it again straight away.
    initialDataUpdatedAt: options.initialData === undefined ? undefined : Date.now(),
  });
}

/** A write operation. Everything is refetched afterwards, which costs next to nothing on loopback. */
export function useOpMutation<I extends z.ZodType, O extends z.ZodType>(contract: Contract<I, O>) {
  const client = useQueryClient();
  return useMutation<z.output<O>, Error, z.input<I>>({
    mutationFn: (input) => callOp(contract, input),
    onSettled: () => client.invalidateQueries(),
  });
}
