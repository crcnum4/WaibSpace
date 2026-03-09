import { registerBlock } from "../../registry";
import { registerGmailComponents } from "./gmail";
import { registerCalendarComponents } from "./gcal";
import { ErrorSurface } from "./ErrorSurface";

/**
 * Register all domain-specific block components.
 * Call once at application startup alongside primitive block registration.
 */
export function registerDomainComponents(): void {
  registerGmailComponents();
  registerCalendarComponents();

  registerBlock("ErrorSurface", ErrorSurface, {
    type: "ErrorSurface",
    category: "domain",
    source: "builtin",
    description:
      "Error surface displayed when a connector or API call fails, with optional retry",
  });
}
