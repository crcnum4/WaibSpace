import { registerGmailComponents } from "./gmail";
import { registerCalendarComponents } from "./gcal";

/**
 * Register all domain-specific block components.
 * Call once at application startup alongside primitive block registration.
 */
export function registerDomainComponents(): void {
  registerGmailComponents();
  registerCalendarComponents();
}
