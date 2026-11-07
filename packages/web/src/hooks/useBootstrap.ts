import type { Bootstrap } from "@octotrack/core/schemas";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchBootstrap } from "../api/client.ts";

export const BOOTSTRAP_KEY = ["bootstrap"];

/** A watching agent's liveness decays with time alone, so this needs refreshing even when nothing changed. */
const REFRESH_MS = 30_000;

export function useBootstrap() {
  return useQuery({
    queryKey: BOOTSTRAP_KEY,
    queryFn: fetchBootstrap,
    refetchInterval: REFRESH_MS,
  });
}

/** Whatever bootstrap already knows, for seeding other queries. */
export function useBootstrapSnapshot(): Bootstrap | undefined {
  return useQueryClient().getQueryData<Bootstrap>(BOOTSTRAP_KEY);
}
