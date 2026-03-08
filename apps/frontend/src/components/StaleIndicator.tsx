interface StaleIndicatorProps {
  /** Timestamp when data was last successfully refreshed */
  timestamp: number;
  /** Whether there were errors during the last refresh */
  hasErrors: boolean;
}

/**
 * Small badge shown on surfaces when data might be stale
 * (e.g., a connector was down during the last refresh).
 */
export function StaleIndicator({ timestamp, hasErrors }: StaleIndicatorProps) {
  if (!hasErrors) return null;

  const age = Date.now() - timestamp;
  const ageLabel = formatAge(age);

  return (
    <span className="stale-indicator" title={`Data may be incomplete. Last update: ${ageLabel} ago`}>
      Stale ({ageLabel})
    </span>
  );
}

function formatAge(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h`;
}
