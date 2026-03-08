/**
 * Skeleton loading placeholders for each surface type.
 * Renders pulsing grey blocks that match the layout of real surfaces.
 */

interface SkeletonSurfaceProps {
  type: "inbox" | "calendar" | "discovery" | "generic";
}

function SkeletonLine({
  width = "100%",
  height = "0.75rem",
}: {
  width?: string;
  height?: string;
}) {
  return (
    <div className="skeleton-line" style={{ width, height }} />
  );
}

function InboxSkeleton() {
  return (
    <div className="surface skeleton-surface inbox-skeleton">
      <div className="skeleton-header">
        <SkeletonLine width="40%" height="1rem" />
        <SkeletonLine width="25%" height="0.75rem" />
      </div>
      <div className="skeleton-list">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton-inbox-item">
            <div className="skeleton-inbox-row">
              <div className="skeleton-dot" />
              <div className="skeleton-inbox-content">
                <div className="skeleton-inbox-top">
                  <SkeletonLine width="35%" height="0.8rem" />
                  <SkeletonLine width="15%" height="0.65rem" />
                </div>
                <SkeletonLine width="60%" height="0.75rem" />
                <SkeletonLine width="80%" height="0.65rem" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CalendarSkeleton() {
  return (
    <div className="surface skeleton-surface calendar-skeleton">
      <div className="skeleton-header">
        <SkeletonLine width="35%" height="1rem" />
        <SkeletonLine width="30%" height="0.75rem" />
      </div>
      <div className="skeleton-timeline">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton-event">
            <SkeletonLine width="25%" height="0.65rem" />
            <SkeletonLine width="55%" height="0.8rem" />
            <SkeletonLine width="40%" height="0.65rem" />
          </div>
        ))}
      </div>
    </div>
  );
}

function DiscoverySkeleton() {
  return (
    <div className="surface skeleton-surface discovery-skeleton">
      <div className="skeleton-header">
        <SkeletonLine width="45%" height="1rem" />
      </div>
      <div className="skeleton-query-bar">
        <SkeletonLine width="70%" height="0.8rem" />
      </div>
      <div className="skeleton-results">
        {[0, 1].map((i) => (
          <div key={i} className="skeleton-result">
            <SkeletonLine width="50%" height="0.8rem" />
            <SkeletonLine width="90%" height="0.65rem" />
            <SkeletonLine width="75%" height="0.65rem" />
            <div className="skeleton-relevance-bar">
              <SkeletonLine width="60%" height="6px" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GenericSkeleton() {
  return (
    <div className="surface skeleton-surface">
      <div className="skeleton-header">
        <SkeletonLine width="40%" height="1rem" />
      </div>
      <div className="skeleton-body">
        <SkeletonLine width="100%" height="0.75rem" />
        <SkeletonLine width="85%" height="0.75rem" />
        <SkeletonLine width="70%" height="0.75rem" />
      </div>
    </div>
  );
}

const skeletonMap: Record<string, React.FC> = {
  inbox: InboxSkeleton,
  calendar: CalendarSkeleton,
  discovery: DiscoverySkeleton,
  generic: GenericSkeleton,
};

export function SkeletonSurface({ type }: SkeletonSurfaceProps) {
  const Component = skeletonMap[type] || GenericSkeleton;
  return <Component />;
}
