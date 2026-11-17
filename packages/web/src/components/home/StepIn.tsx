import type { Line } from "@octotrack/core/schemas";
import { useState } from "react";
import { stepInRef } from "../../lib/focus.ts";
import { TableForm } from "../lines/TableForm.tsx";
import { Actions } from "../ui/Actions.tsx";
import { Button } from "../ui/Button.tsx";
import { Focusable } from "../ui/Focusable.tsx";
import { Callout } from "../ui/Callout.tsx";
import { Markdown } from "../ui/Markdown.tsx";
import { CheckoutForm } from "./CheckoutForm.tsx";

export interface StepInProps {
  line: Line;
  /** What happened, and what would fix it. */
  reason: string;
  focused?: boolean;
  /** A start keeps failing or never took the line: Try now starts one again, for every line stopped the same way. */
  onRetry?: (ref: string) => void;
  /** Every session the cap allows is an owner: Start one anyway, past the cap, once. */
  onAnyway?: (ref: string) => void;
  /** A clone failed: where this machine already has the repo. */
  checkoutRepo?: string;
  onCheckout?: (ref: string, repo: string, path: string) => void;
  onOwn(ref: string): void;
  onTable(ref: string, reason: string, lookAgainAt: string | null): void;
  /** What was pressed waits with Undo: it says it is on its way, and nothing else is pressed meanwhile. */
  busy?: boolean;
}

/**
 * A working line no agent could be found for, set apart in the warm tone: Step in, what happened, and the action that
 * fits, with Table and own beside.
 */
export function StepIn({
  line,
  reason,
  focused = false,
  onRetry,
  onAnyway,
  checkoutRepo,
  onCheckout,
  onOwn,
  onTable,
  busy = false,
}: StepInProps) {
  const [mode, setMode] = useState<"table" | "checkout" | null>(null);
  // Which action was pressed, so that it says it is on its way while it waits.
  const [pressed, setPressed] = useState<"retry" | "anyway" | "own" | null>(null);
  const press = (action: "retry" | "anyway" | "own", act: () => void) => () => {
    setPressed(action);
    act();
  };
  const word = (action: "retry" | "anyway" | "own", busyWord: string) =>
    busy && pressed === action ? busyWord : undefined;
  const offered = [
    checkoutRepo !== undefined && onCheckout !== undefined ? "checkout" : null,
    onRetry === undefined ? null : "retry",
    onAnyway === undefined ? null : "anyway",
    "own",
    "table",
  ].filter((action) => action !== null);
  const number = (action: string) => offered.indexOf(action) + 1;
  // The way forward is filled; own and Table follow it.
  const forward = offered[0] === "own" ? null : offered[0];
  return (
    <Focusable focusRef={stepInRef(line.ref)} label={`Step in on ${line.title}`} focused={focused}>
      <Callout
        tone="warn"
        mark="alert"
        lead="Step in."
        actions={
          mode === "checkout" && checkoutRepo !== undefined && onCheckout !== undefined ? (
            // The form stays while the path is being set, so a path that fails is still there to fix.
            <CheckoutForm
              repo={checkoutRepo}
              busy={busy}
              onSet={(path) => onCheckout(line.ref, checkoutRepo, path)}
              onCancel={() => setMode(null)}
            />
          ) : (
            <Actions>
              {checkoutRepo === undefined || onCheckout === undefined ? null : (
                <Button
                  variant={forward === "checkout" ? "primary" : "plain"}
                  choice={number("checkout")}
                  onClick={() => setMode("checkout")}
                >
                  Set its checkout
                </Button>
              )}
              {onRetry === undefined ? null : (
                <Button
                  variant={forward === "retry" ? "primary" : "plain"}
                  choice={number("retry")}
                  disabled={busy}
                  busy={word("retry", "Trying…")}
                  onClick={press("retry", () => onRetry(line.ref))}
                >
                  Try now
                </Button>
              )}
              {onAnyway === undefined ? null : (
                <Button
                  variant={forward === "anyway" ? "primary" : "plain"}
                  choice={number("anyway")}
                  disabled={busy}
                  busy={word("anyway", "Starting…")}
                  onClick={press("anyway", () => onAnyway(line.ref))}
                >
                  Start one anyway
                </Button>
              )}
              <Button
                choice={number("own")}
                disabled={busy}
                busy={word("own", "Owning…")}
                onClick={press("own", () => onOwn(line.ref))}
              >
                I'll own it
              </Button>
              <Button choice={number("table")} disabled={busy} onClick={() => setMode("table")}>
                Table it
              </Button>
            </Actions>
          )
        }
      >
        <Markdown text={reason} inline />
      </Callout>
      {mode === "table" ? (
        <TableForm
          title={line.title}
          onTable={(why, lookAgainAt) => {
            onTable(line.ref, why, lookAgainAt);
            setMode(null);
          }}
          onCancel={() => setMode(null)}
        />
      ) : null}
    </Focusable>
  );
}
