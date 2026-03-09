import type { SurfaceSpec, ProvenanceMetadata } from "@waibspace/types";
import { SurfaceSpecBuilder } from "./builder";
import type {
  InboxSurfaceData,
  CalendarSurfaceData,
  DiscoverySurfaceData,
  ApprovalSurfaceData,
  ConnectionGuideSurfaceData,
  MorningDigestSurfaceData,
} from "./surface-data";

export class SurfaceFactory {
  static inbox(
    data: InboxSurfaceData,
    provenance: ProvenanceMetadata
  ): SurfaceSpec {
    return new SurfaceSpecBuilder("inbox")
      .setTitle(`Inbox (${data.unreadCount} unread)`)
      .setSummary(
        `${data.totalCount} messages, ${data.unreadCount} unread`
      )
      .setPriority(70)
      .setData(data)
      .setLayout({
        position: "primary",
        prominence: "standard",
      })
      .addAction({
        id: "mark-read",
        label: "Mark All Read",
        actionType: "inbox.markAllRead",
        riskClass: "A",
      })
      .addAction({
        id: "archive",
        label: "Archive",
        actionType: "inbox.archive",
        riskClass: "A",
      })
      .addAction({
        id: "reply",
        label: "Reply",
        actionType: "inbox.reply",
        riskClass: "B",
      })
      .setProvenance(provenance)
      .build();
  }

  static calendar(
    data: CalendarSurfaceData,
    provenance: ProvenanceMetadata
  ): SurfaceSpec {
    return new SurfaceSpecBuilder("calendar")
      .setTitle("Calendar")
      .setSummary(
        `${data.events.length} events, ${data.freeSlots.length} free slots`
      )
      .setPriority(60)
      .setData(data)
      .setLayout({
        position: "secondary",
        prominence: "standard",
      })
      .setProvenance(provenance)
      .build();
  }

  static discovery(
    data: DiscoverySurfaceData,
    provenance: ProvenanceMetadata
  ): SurfaceSpec {
    return new SurfaceSpecBuilder("discovery")
      .setTitle(`Results for "${data.query}"`)
      .setSummary(`${data.results.length} results found`)
      .setPriority(80)
      .setData(data)
      .setLayout({
        position: "primary",
        prominence: "hero",
      })
      .setProvenance(provenance)
      .build();
  }

  static approval(data: ApprovalSurfaceData): SurfaceSpec {
    return new SurfaceSpecBuilder("approval")
      .setTitle("Approval Required")
      .setSummary(data.actionDescription)
      .setPriority(100)
      .setData(data)
      .setLayout({
        position: "overlay",
        prominence: "hero",
      })
      .addAction({
        id: "approve",
        label: "Approve",
        actionType: "approval.approve",
        riskClass: data.riskClass,
        payload: { approvalId: data.approvalId },
      })
      .addAction({
        id: "deny",
        label: "Deny",
        actionType: "approval.deny",
        riskClass: "A",
        payload: { approvalId: data.approvalId },
      })
      .setProvenance({
        sourceType: "system",
        sourceId: "policy-engine",
        trustLevel: "trusted",
        timestamp: Date.now(),
        freshness: "realtime",
        dataState: "raw",
      })
      .build();
  }

  static connectionGuide(
    data: ConnectionGuideSurfaceData,
    provenance: ProvenanceMetadata
  ): SurfaceSpec {
    const title = data.selectedService
      ? `Connect ${data.selectedService.name}`
      : "Connect a Service";
    return new SurfaceSpecBuilder("connection-guide")
      .setTitle(title)
      .setSummary(data.message)
      .setPriority(90)
      .setData(data)
      .setLayout({
        position: "primary",
        prominence: "hero",
      })
      .setProvenance(provenance)
      .build();
  }

  static morningDigest(
    data: MorningDigestSurfaceData,
    provenance: ProvenanceMetadata
  ): SurfaceSpec {
    const urgentCount = data.inbox.urgentEmails.length;
    const eventCount = data.calendar.eventCount;
    const summary = [
      `${data.inbox.unreadCount} unread`,
      urgentCount > 0 ? `${urgentCount} urgent` : null,
      `${eventCount} event${eventCount !== 1 ? "s" : ""} today`,
    ]
      .filter(Boolean)
      .join(", ");

    return new SurfaceSpecBuilder("morning-digest")
      .setTitle(data.greeting)
      .setSummary(summary)
      .setPriority(95) // high priority — show at top of dashboard
      .setData(data)
      .setLayout({
        position: "primary",
        prominence: "hero",
      })
      .addAction({
        id: "dismiss-digest",
        label: "Dismiss",
        actionType: "digest.dismiss",
        riskClass: "A",
      })
      .addAction({
        id: "open-inbox",
        label: "Open Inbox",
        actionType: "navigate.inbox",
        riskClass: "A",
      })
      .setProvenance(provenance)
      .build();
  }

  static generic(
    title: string,
    data: unknown,
    provenance: ProvenanceMetadata
  ): SurfaceSpec {
    return new SurfaceSpecBuilder("generic")
      .setTitle(title)
      .setPriority(50)
      .setData(data)
      .setLayout({
        position: "secondary",
        prominence: "compact",
      })
      .setProvenance(provenance)
      .build();
  }
}
