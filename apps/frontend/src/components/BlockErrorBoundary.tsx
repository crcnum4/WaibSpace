/**
 * BlockErrorBoundary — Catches render errors in individual blocks
 *
 * Wraps each block in an error boundary so that a single broken block
 * does not tear down the entire surface grid. Shows a compact fallback
 * card with the error message and a retry button that resets the boundary.
 */

import { Component, type ReactNode } from "react";

// ---------------------------------------------------------------------------
// Props & State
// ---------------------------------------------------------------------------

interface BlockErrorBoundaryProps {
  /** Unique key for the block being wrapped (used in error reporting). */
  blockId?: string;
  children: ReactNode;
}

interface BlockErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export class BlockErrorBoundary extends Component<
  BlockErrorBoundaryProps,
  BlockErrorBoundaryState
> {
  constructor(props: BlockErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): BlockErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    if (import.meta.env.DEV) {
      console.error(
        `[BlockErrorBoundary] Block "${this.props.blockId ?? "unknown"}" crashed:`,
        error,
        info.componentStack,
      );
    }
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      const message =
        this.state.error?.message ?? "An unexpected error occurred.";

      return (
        <div className="block-error" role="alert">
          <div className="block-error__icon" aria-hidden="true">
            !
          </div>
          <div className="block-error__body">
            <p className="block-error__title">Block failed to render</p>
            <p className="block-error__message">{message}</p>
            {this.props.blockId && (
              <p className="block-error__code">{this.props.blockId}</p>
            )}
          </div>
          <button
            type="button"
            className="block-error__retry"
            onClick={this.handleRetry}
          >
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
