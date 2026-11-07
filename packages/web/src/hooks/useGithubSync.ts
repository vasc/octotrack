import { useMutation, useQueryClient } from "@tanstack/react-query";
import { syncGithub } from "../api/client.ts";

/** Pulls PR status from GitHub right now, instead of waiting for the background sync. */
export function useGithubSync() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: syncGithub,
    onSettled: () => client.invalidateQueries(),
  });
}
