import type { BlockProps } from "../../../registry";

interface GmailScanResultProps {
  summary: string;
  highUrgencyCount: number;
  recommendations: string[];
}

export function GmailScanResult({ block }: BlockProps) {
  const { summary, highUrgencyCount, recommendations } =
    block.props as GmailScanResultProps;

  return (
    <div className="gmail-scan-result">
      <p className="gmail-scan-result__summary">{summary}</p>
      {highUrgencyCount > 0 && (
        <div className="gmail-scan-result__urgency">
          <span className="gmail-scan-result__urgency-count">
            {highUrgencyCount}
          </span>{" "}
          high-urgency email{highUrgencyCount !== 1 ? "s" : ""}
        </div>
      )}
      {recommendations.length > 0 && (
        <ul className="gmail-scan-result__recommendations">
          {recommendations.map((rec, i) => (
            <li key={i} className="gmail-scan-result__recommendation">
              {rec}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
