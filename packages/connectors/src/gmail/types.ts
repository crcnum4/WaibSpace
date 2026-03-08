export interface EmailSummary {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  snippet: string;
  date: string;
  labels: string[];
  isUnread: boolean;
}

export interface ListEmailsParams {
  maxResults?: number;
  query?: string;
  labelIds?: string[];
}

export interface GetEmailParams {
  emailId: string;
}

export interface SearchEmailsParams {
  query: string;
  maxResults?: number;
}

export interface CreateDraftParams {
  to: string;
  subject: string;
  body: string;
  inReplyTo?: string;
}

export interface SendEmailParams {
  to?: string;
  subject?: string;
  body?: string;
  draftId?: string;
}
