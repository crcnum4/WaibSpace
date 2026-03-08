export interface CalendarEvent {
  id: string;
  summary: string;
  start: string; // ISO datetime
  end: string;
  location?: string;
  description?: string;
  attendees?: string[];
  status: string;
}

export interface FreeSlot {
  start: string;
  end: string;
}
