import type { ReactNode } from "react";

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div className="state" role="status">
      {label}...
    </div>
  );
}

export function ErrorState({ error }: { error: Error }) {
  return (
    <div className="state" data-error="true" role="alert">
      {error.message}
    </div>
  );
}

export function EmptyState({ children, command }: { children: ReactNode; command?: string }) {
  return (
    <div className="state">
      <div>{children}</div>
      {command === undefined ? null : <pre>{command}</pre>}
    </div>
  );
}
