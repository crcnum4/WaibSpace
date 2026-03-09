import type { BlockProps } from "../../registry";

interface ErrorSurfaceProps {
  title: string;
  message: string;
  retryable: boolean;
  errorCode?: string;
}

/**
 * Error surface block displayed when a connector or API call fails.
 * Shows a warning/error card with optional retry action.
 */
export function ErrorSurface({ block, onEvent }: BlockProps) {
  const {
    title,
    message,
    retryable,
    errorCode,
  } = block.props as ErrorSurfaceProps;

  return (
    <div className="error-surface">
      <div className="error-surface__icon">{"\u26A0"}</div>

      <div className="error-surface__body">
        <div className="error-surface__title">{title}</div>
        <div className="error-surface__message">{message}</div>

        {errorCode && (
          <div className="error-surface__code">Code: {errorCode}</div>
        )}
      </div>

      {retryable && (
        <button
          className="error-surface__retry"
          type="button"
          onClick={() => onEvent?.("retry")}
        >
          Retry
        </button>
      )}
    </div>
  );
}
