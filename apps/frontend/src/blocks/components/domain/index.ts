import { registerBlock, registerBlocks } from "../../registry";
import { registerCalendarComponents } from "./gcal";
import { ErrorSurface } from "./ErrorSurface";
import { BriefingCard } from "./BriefingCard";
import { ActionCard } from "./ActionCard";
import { InsightCard } from "./InsightCard";
import { StatusCard } from "./StatusCard";

/**
 * Register all domain-specific block components.
 * Call once at application startup alongside primitive block registration.
 */
export function registerDomainComponents(): void {
  registerCalendarComponents();

  registerBlock("ErrorSurface", ErrorSurface, {
    type: "ErrorSurface",
    category: "domain",
    source: "builtin",
    description:
      "Error surface displayed when a connector or API call fails, with optional retry",
  });

  registerBlocks([
    {
      type: "briefing-card",
      component: BriefingCard,
      registration: {
        type: "briefing-card",
        category: "domain",
        source: "builtin",
        description:
          "Briefing card summarising what needs the user's attention",
      },
    },
    {
      type: "action-card",
      component: ActionCard,
      registration: {
        type: "action-card",
        category: "domain",
        source: "builtin",
        description:
          "Action card with drafted content requiring user approval",
      },
    },
    {
      type: "insight-card",
      component: InsightCard,
      registration: {
        type: "insight-card",
        category: "domain",
        source: "builtin",
        description:
          "Insight card showing autonomous actions Waib performed",
      },
    },
    {
      type: "status-card",
      component: StatusCard,
      registration: {
        type: "status-card",
        category: "domain",
        source: "builtin",
        description:
          "System status card with connector health and memory statistics",
      },
    },
  ]);
}
