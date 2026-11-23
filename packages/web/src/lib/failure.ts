import { ApiError } from "../api/client.ts";

/**
 * What a failure means, in words the page can show: the tracker's own message and hint when it refused, that it did
 * not answer when the request never arrived, and never the raw text of a parse or schema error.
 */
export function failureText(error: Error): { text: string; hint: string | null } {
  if (error instanceof ApiError) return { text: error.message, hint: error.hint };
  if (error instanceof TypeError) return { text: "The tracker did not answer.", hint: null };
  return { text: "The tracker sent something this page does not understand. Reload.", hint: null };
}
