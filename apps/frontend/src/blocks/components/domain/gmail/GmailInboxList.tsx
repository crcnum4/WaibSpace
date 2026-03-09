import { useState } from "react";
import type { BlockProps } from "../../../registry";

interface GmailInboxListProps {
  unreadCount: number;
  totalCount: number;
  isScanned: boolean;
  error?: string;
}

export function GmailInboxList({ block, children, onEvent }: BlockProps) {
  const { unreadCount, isScanned, error } = block.props as GmailInboxListProps;
  const [isScanning, setIsScanning] = useState(false);

  const handleScan = () => {
    setIsScanning(true);
    onEvent?.("waib-scan", { scope: "all" });
  };

  return (
    <div className="gmail-inbox-list">
      <div className="gmail-inbox-list__header">
        <div className="gmail-inbox-list__title-row">
          <h3 className="gmail-inbox-list__title">Inbox</h3>
          {!error && unreadCount > 0 && (
            <span className="gmail-inbox-list__badge">{unreadCount}</span>
          )}
        </div>
        {!isScanned && !error && (
          <button
            className={`gmail-inbox-list__scan-btn${isScanning ? " gmail-inbox-list__scan-btn--loading" : ""}`}
            onClick={handleScan}
            disabled={isScanning}
          >
            {isScanning ? (
              <>
                <span className="gmail-inbox-list__scan-spinner" />
                Scanning…
              </>
            ) : (
              "WaibScan"
            )}
          </button>
        )}
      </div>
      {error ? (
        <div className="gmail-inbox-list__error">
          <p className="gmail-inbox-list__error-text">{error}</p>
        </div>
      ) : (
        <div className="gmail-inbox-list__cards">{children}</div>
      )}
    </div>
  );
}
