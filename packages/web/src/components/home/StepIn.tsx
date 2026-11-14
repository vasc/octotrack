import type { Line } from "@octotrack/core/schemas";
import { useState } from "react";
import { TableForm } from "../lines/TableForm.tsx";
import { CheckoutForm } from "./CheckoutForm.tsx";
import { stepInRef } from "../../lib/focus.ts";

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
}

/** A working line no agent could be found for: what happened, and the action that fits, with Table and own beside. */
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
}: StepInProps) {
  const [mode, setMode] = useState<"table" | "checkout" | null>(null);
  const offered = [
    checkoutRepo !== undefined && onCheckout !== undefined ? "checkout" : null,
    onRetry === undefined ? null : "retry",
    onAnyway === undefined ? null : "anyway",
    "table",
    "own",
  ].filter((action) => action !== null);
  const number = (action: string) => String(offered.indexOf(action) + 1);
  return (
    <div
      className="step-in"
      role="note"
      aria-label={`Step in on ${line.title}`}
      data-selected={focused}
      aria-current={focused ? "true" : undefined}
      data-focus-ref={stepInRef(line.ref)}
      tabIndex={-1}
    >
      <p>
        <span className="step-in-label">Step in</span> {reason}
      </p>
      {mode === "table" ? (
        <TableForm
          title={line.title}
          onTable={(why, lookAgainAt) => {
            onTable(line.ref, why, lookAgainAt);
            setMode(null);
          }}
          onCancel={() => setMode(null)}
        />
      ) : mode === "checkout" && checkoutRepo !== undefined && onCheckout !== undefined ? (
        <CheckoutForm
          repo={checkoutRepo}
          onSet={(path) => {
            onCheckout(line.ref, checkoutRepo, path);
            setMode(null);
          }}
          onCancel={() => setMode(null)}
        />
      ) : (
        <div className="decision-actions">
          {/* Numbered in the order drawn, for the number keys. */}
          {checkoutRepo === undefined || onCheckout === undefined ? null : (
            <button
              type="button"
              className="btn"
              data-tone="bad"
              data-choice={number("checkout")}
              onClick={() => setMode("checkout")}
            >
              Set its checkout
            </button>
          )}
          {onRetry === undefined ? null : (
            <button
              type="button"
              className="btn"
              data-tone="bad"
              data-choice={number("retry")}
              onClick={() => onRetry(line.ref)}
            >
              Try now
            </button>
          )}
          {onAnyway === undefined ? null : (
            <button
              type="button"
              className="btn"
              data-tone="bad"
              data-choice={number("anyway")}
              onClick={() => onAnyway(line.ref)}
            >
              Start one anyway
            </button>
          )}
          <button
            type="button"
            className="btn"
            data-choice={number("table")}
            onClick={() => setMode("table")}
          >
            Table it
          </button>
          <button type="button" className="btn" data-choice={number("own")} onClick={() => onOwn(line.ref)}>
            I'll own it
          </button>
        </div>
      )}
    </div>
  );
}
