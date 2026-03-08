export type {
  Connector,
  ConnectorRequest,
  ConnectorResponse,
  ConnectorAction,
  ConnectorResult,
} from "./types";
export { BaseConnector } from "./base-connector";
export type { BaseConnectorConfig } from "./base-connector";
export { ConnectorRegistry } from "./registry";
export { GmailConnector } from "./gmail";
export type {
  EmailSummary,
  ListEmailsParams,
  GetEmailParams,
  SearchEmailsParams,
  CreateDraftParams,
  SendEmailParams,
} from "./gmail";
