import { contracts } from "@octotrack/core/contracts";
import { useRef, useState } from "react";
import { callOp } from "../api/client.ts";
import { useOpQuery } from "./useOp.ts";

/** Typing stops for this long before the draft is kept. */
const SAVE_AFTER_MS = 500;

/**
 * A half-written answer, note or outcome, kept on the server as it is typed, so it can be finished another day or on
 * another device. Saving it refreshes nothing else on the page.
 */
export function useDraft(key: string) {
  const saved = useOpQuery(contracts.draftGet, { key });
  const [typed, setTyped] = useState<string | null>(null);
  // The draft as it was when the field opened. A later save from another tab must not change the text under the cursor.
  const [opened, setOpened] = useState<string | null>(null);
  if (opened === null && saved.data !== undefined) setOpened(saved.data.text ?? "");
  // The pending save lives outside rendering: a new keystroke replaces it, and nothing on screen depends on it.
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const save = (text: string, after: number) => {
    if (pending.current !== null) clearTimeout(pending.current);
    pending.current = setTimeout(() => {
      pending.current = null;
      void callOp(contracts.draftSave, { key, text }).catch(() => {});
    }, after);
  };
  return {
    value: typed ?? opened ?? saved.data?.text ?? "",
    change(text: string) {
      setTyped(text);
      save(text, SAVE_AFTER_MS);
    },
    clear() {
      setTyped("");
      save("", 0);
    },
  };
}
