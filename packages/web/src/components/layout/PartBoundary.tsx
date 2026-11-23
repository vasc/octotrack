import { Component, type ErrorInfo, type ReactNode } from "react";
import { PartFailed } from "./PartFailed.tsx";

/**
 * Catches a bug in one part of the page, so that a broken panel leaves Lines working and the reverse. A class, because
 * React catches a render error only in one.
 */
export class PartBoundary extends Component<
  { children: ReactNode; onReload?: () => void },
  { error: Error | null }
> {
  override state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error };
  }

  override componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // The error is shown in place, to report; nothing else is done with it.
  }

  override render(): ReactNode {
    if (this.state.error === null) return this.props.children;
    return (
      <PartFailed
        error={this.state.error}
        onReload={this.props.onReload ?? (() => window.location.reload())}
      />
    );
  }
}
