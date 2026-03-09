import { registerGmailComponents } from "./gmail";

/**
 * Register all domain-specific block components.
 * Call once at application startup alongside primitive block registration.
 */
export function registerDomainComponents(): void {
  registerGmailComponents();
}
