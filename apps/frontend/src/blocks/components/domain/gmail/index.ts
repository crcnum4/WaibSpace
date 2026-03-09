import { registerBlocks } from "../../../registry";
import { GmailEmailCard } from "./GmailEmailCard";
import { GmailInboxList } from "./GmailInboxList";
import { GmailScanResult } from "./GmailScanResult";

/**
 * Register all Gmail domain block components.
 * Call once at application startup alongside primitive block registration.
 */
export function registerGmailComponents(): void {
  registerBlocks([
    {
      type: "GmailEmailCard",
      component: GmailEmailCard,
      registration: {
        type: "GmailEmailCard",
        category: "domain",
        source: "gmail.waib",
        description: "Individual email card with sender avatar, subject, snippet, and urgency",
      },
    },
    {
      type: "GmailInboxList",
      component: GmailInboxList,
      registration: {
        type: "GmailInboxList",
        category: "domain",
        source: "gmail.waib",
        description: "Inbox list wrapper with header, unread badge, and WaibScan trigger",
      },
    },
    {
      type: "GmailScanResult",
      component: GmailScanResult,
      registration: {
        type: "GmailScanResult",
        category: "domain",
        source: "gmail.waib",
        description: "Summary card displayed after WaibScan analysis",
      },
    },
  ]);
}
