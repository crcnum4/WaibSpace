import type { BlockProps } from "../../../registry";

interface GmailInboxListProps {
  unreadCount: number;
  totalCount: number;
  isScanned: boolean;
}

export function GmailInboxList({ block, children, onEvent }: BlockProps) {
  const { unreadCount, isScanned } = block.props as GmailInboxListProps;

  return (
    <div className="gmail-inbox-list">
      <div className="gmail-inbox-list__header">
        <div className="gmail-inbox-list__title-row">
          <h3 className="gmail-inbox-list__title">Inbox</h3>
          {unreadCount > 0 && (
            <span className="gmail-inbox-list__badge">{unreadCount}</span>
          )}
        </div>
        {!isScanned && (
          <button
            className="gmail-inbox-list__scan-btn"
            onClick={() => onEvent?.("waib-scan", { scope: "all" })}
          >
            WaibScan
          </button>
        )}
      </div>
      <div className="gmail-inbox-list__cards">{children}</div>
    </div>
  );
}
