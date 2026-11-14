import { contracts } from "@octotrack/core/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { callOp } from "../api/client.ts";
import { useOpQuery } from "./useOp.ts";

/** Typing stops for this long before the draft is kept. */
const SAVE_AFTER_MS = 500;

/**
 * A half-written answer, note or outcome, kept on the server as it is typed, so it can be finished another day or on
 * another device. While nothing typed here is waiting to be saved, it shows the server's draft, so words typed on
 * another device arrive, and a draft deleted because its choice took effect empties the box. The box itself keeps
 * what it shows while it has focus (TextBox), so nothing changes under the cursor.
 */
export function useDraft(key: string) {
  const client = useQueryClient();
  const saved = useOpQuery(contracts.draftGet, { key });
  // Typed here and not yet kept by the server; null once the server holds it.
  const [typed, setTyped] = useState<string | null>(null);
  // Why the last save failed, until one succeeds: the words are still on this screen, but nowhere else.
  const [error, setError] = useState<string | null>(null);
  // The pending save lives outside rendering: a new keystroke replaces it, and nothing on screen depends on it.
  const pending = useRef<{ timer: ReturnType<typeof setTimeout>; text: string } | null>(null);
  const latest = useRef(0);
  const keep = (text: string): Promise<void> => {
    latest.current += 1;
    const attempt = latest.current;
    return callOp(contracts.draftSave, { key, text })
      .then((kept) => {
        // An older save landing after a newer one started changes nothing.
        if (attempt !== latest.current) return;
        client.setQueryData([contracts.draftGet.name, { key }], kept);
        // What is typed here stays shown until the server holds the newest of it: keystrokes still waiting for their
        // save keep it.
        setError(null);
        if (pending.current === null) setTyped(null);
      })
      .catch((failure: unknown) => {
        setError(failure instanceof Error ? failure.message : String(failure));
      });
  };
  const save = (text: string, after: number) => {
    if (pending.current !== null) clearTimeout(pending.current.timer);
    pending.current = {
      text,
      timer: setTimeout(() => {
        pending.current = null;
        void keep(text);
      }, after),
    };
  };
  return {
    value: typed ?? saved.data?.text ?? "",
    error,
    change(text: string) {
      setTyped(text);
      save(text, SAVE_AFTER_MS);
    },
    clear() {
      setTyped("");
      save("", 0);
    },
    /**
     * Keeps what is typed now, before a choice that names this draft is made: a save landing after the choice took
     * effect would bring the sent words back.
     */
    flush(): Promise<void> {
      const waiting = pending.current;
      if (waiting === null) return Promise.resolve();
      clearTimeout(waiting.timer);
      pending.current = null;
      return keep(waiting.text);
    },
  };
}
