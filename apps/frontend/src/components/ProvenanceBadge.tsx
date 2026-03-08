import { useState } from "react";
import type { ProvenanceMetadata } from "@waibspace/types";

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function ProvenanceBadge({
  provenance,
}: {
  provenance: ProvenanceMetadata;
}) {
  const [expanded, setExpanded] = useState(false);

  const trustColor = {
    trusted: "#22c55e",
    "semi-trusted": "#eab308",
    untrusted: "#f97316",
  }[provenance.trustLevel];

  const trustIcon = {
    trusted: "\u2713",
    "semi-trusted": "\u26A0",
    untrusted: "\u26A1",
  }[provenance.trustLevel];

  const timeAgo = formatTimeAgo(provenance.timestamp);

  return (
    <div
      className={`provenance-badge trust-${provenance.trustLevel}`}
      onClick={() => setExpanded(!expanded)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") setExpanded(!expanded);
      }}
    >
      <span className="trust-indicator" style={{ color: trustColor }}>
        {trustIcon}
      </span>
      <span className="provenance-source">from {provenance.sourceType}</span>
      <span className="provenance-freshness">{timeAgo}</span>
      {expanded && (
        <div className="provenance-details">
          <div>Trust: {provenance.trustLevel}</div>
          <div>State: {provenance.dataState}</div>
          {provenance.transformations?.length && (
            <div>
              Transforms: {provenance.transformations.join(" \u2192 ")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
