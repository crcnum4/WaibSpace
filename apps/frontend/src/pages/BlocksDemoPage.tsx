/**
 * BlocksDemoPage — Standalone demo proving the full WaibRenderer stack.
 *
 * Left panel: rendered block tree (inbox layout).
 * Right panel: observation log capturing every interaction.
 */

import { useState, useCallback } from "react";
import type { ComponentBlock } from "@waibspace/types";
import { WaibRenderer } from "../blocks/WaibRenderer";

// ---------------------------------------------------------------------------
// Hard-coded inbox block tree
// ---------------------------------------------------------------------------

const inboxBlocks: ComponentBlock[] = [
  {
    id: "root",
    type: "Container",
    props: { direction: "column", gap: "16px", padding: "24px" },
    children: [
      {
        id: "inbox-title",
        type: "Text",
        props: { content: "Inbox - 3 messages", variant: "h2" },
      },
      {
        id: "message-list",
        type: "List",
        props: {},
        children: [
          // --- Email 1: Alice (planned onClick) ---
          {
            id: "email-1",
            type: "ListItem",
            props: {},
            events: {
              onClick: {
                action: "emit",
                event: "email.open",
                payload: { emailId: "e-101", from: "alice@example.com" },
              },
            },
            children: [
              {
                id: "email-1-row",
                type: "Row",
                props: { gap: "12px", align: "center" },
                children: [
                  {
                    id: "email-1-badge",
                    type: "Badge",
                    props: { variant: "dot", color: "#ef4444" },
                  },
                  {
                    id: "email-1-stack",
                    type: "Stack",
                    props: { gap: "2px" },
                    children: [
                      {
                        id: "email-1-from",
                        type: "Text",
                        props: { content: "Alice Chen", variant: "label" },
                      },
                      {
                        id: "email-1-subject",
                        type: "Text",
                        props: {
                          content: "Q1 Budget Review - Action Required",
                          variant: "body",
                          weight: "var(--weight-bold)",
                        },
                      },
                      {
                        id: "email-1-snippet",
                        type: "Text",
                        props: {
                          content: "Please review the attached budget proposal...",
                          variant: "caption",
                          color: "var(--color-muted)",
                        },
                      },
                    ],
                  },
                ],
              },
            ],
          },

          // --- Email 2: Bob (planned onClick) ---
          {
            id: "email-2",
            type: "ListItem",
            props: {},
            events: {
              onClick: {
                action: "emit",
                event: "email.open",
                payload: { emailId: "e-102", from: "bob@example.com" },
              },
            },
            children: [
              {
                id: "email-2-row",
                type: "Row",
                props: { gap: "12px", align: "center" },
                children: [
                  {
                    id: "email-2-badge",
                    type: "Badge",
                    props: { variant: "dot", color: "#eab308" },
                  },
                  {
                    id: "email-2-stack",
                    type: "Stack",
                    props: { gap: "2px" },
                    children: [
                      {
                        id: "email-2-from",
                        type: "Text",
                        props: { content: "Bob Martinez", variant: "label" },
                      },
                      {
                        id: "email-2-subject",
                        type: "Text",
                        props: {
                          content: "Team offsite agenda draft",
                          variant: "body",
                          weight: "var(--weight-bold)",
                        },
                      },
                      {
                        id: "email-2-snippet",
                        type: "Text",
                        props: {
                          content: "Here is the draft agenda for next week's offsite...",
                          variant: "caption",
                          color: "var(--color-muted)",
                        },
                      },
                    ],
                  },
                ],
              },
            ],
          },

          // --- Email 3: Carol (planned onClick + Expandable reply) ---
          {
            id: "email-3",
            type: "ListItem",
            props: {},
            events: {
              onClick: {
                action: "emit",
                event: "email.open",
                payload: { emailId: "e-103", from: "carol@example.com" },
              },
            },
            children: [
              {
                id: "email-3-row",
                type: "Row",
                props: { gap: "12px", align: "center" },
                children: [
                  {
                    id: "email-3-badge",
                    type: "Badge",
                    props: { variant: "dot", color: "#3b82f6" },
                  },
                  {
                    id: "email-3-stack",
                    type: "Stack",
                    props: { gap: "2px" },
                    children: [
                      {
                        id: "email-3-from",
                        type: "Text",
                        props: { content: "Carol Wu", variant: "label" },
                      },
                      {
                        id: "email-3-subject",
                        type: "Text",
                        props: {
                          content: "Design system color tokens",
                          variant: "body",
                          weight: "var(--weight-bold)",
                        },
                      },
                      {
                        id: "email-3-snippet",
                        type: "Text",
                        props: {
                          content: "I've updated the color tokens in Figma, can you take a look?",
                          variant: "caption",
                          color: "var(--color-muted)",
                        },
                      },
                    ],
                  },
                ],
              },
              {
                id: "email-3-expandable",
                type: "Expandable",
                props: { header: "Quick Reply", defaultOpen: false },
                children: [
                  {
                    id: "email-3-reply-input",
                    type: "TextInput",
                    props: {
                      placeholder: "Type your reply...",
                      multiline: true,
                      stateKey: "reply-carol",
                    },
                  },
                  {
                    id: "email-3-reply-btn",
                    type: "Button",
                    props: { label: "Send Reply", variant: "primary" },
                    events: {
                      onClick: {
                        action: "emit",
                        event: "email.reply",
                        payload: { emailId: "e-103" },
                      },
                    },
                  },
                ],
              },
            ],
          },
        ],
      },

      // --- Divider ---
      { id: "divider-1", type: "Divider", props: {} },

      // --- Quick Actions ---
      {
        id: "actions-title",
        type: "Text",
        props: { content: "Quick Actions", variant: "h3" },
      },
      {
        id: "actions-row",
        type: "Row",
        props: { gap: "12px" },
        children: [
          {
            id: "btn-mark-read",
            type: "Button",
            props: { label: "Mark All Read", variant: "secondary" },
            events: {
              onClick: {
                action: "emit",
                event: "inbox.markAllRead",
              },
            },
          },
          {
            id: "btn-compose",
            type: "Button",
            props: { label: "Compose", variant: "primary" },
            events: {
              onClick: {
                action: "emit",
                event: "inbox.compose",
              },
            },
          },
        ],
      },

      // --- Divider ---
      { id: "divider-2", type: "Divider", props: {} },

      // --- Image Support ---
      {
        id: "image-title",
        type: "Text",
        props: { content: "Image Support", variant: "h3" },
      },
      {
        id: "demo-image",
        type: "Image",
        props: {
          src: "https://picsum.photos/600/200",
          alt: "Demo image",
          height: "200px",
        },
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Observation entry type
// ---------------------------------------------------------------------------

interface ObservationEntry {
  blockId: string;
  blockType: string;
  interactionType: string;
  wasPlanned: boolean;
  time: string;
}

// ---------------------------------------------------------------------------
// BlocksDemoPage
// ---------------------------------------------------------------------------

export default function BlocksDemoPage() {
  const [observations, setObservations] = useState<ObservationEntry[]>([]);

  const send = useCallback((type: string, payload: unknown) => {
    if (type === "user.interaction") {
      const p = payload as Record<string, unknown>;
      const batch = p?.batch as Array<Record<string, unknown>> | undefined;
      const now = new Date().toLocaleTimeString();
      if (batch && Array.isArray(batch)) {
        const entries: ObservationEntry[] = batch.map((obs) => ({
          blockId: (obs.blockId as string) ?? "unknown",
          blockType: (obs.blockType as string) ?? "unknown",
          interactionType: (obs.interactionType as string) ?? "unknown",
          wasPlanned: (obs.wasPlanned as boolean) ?? false,
          time: now,
        }));
        setObservations((prev) => [...prev.slice(-50), ...entries]);
      }
    }
  }, []);

  return (
    <div
      style={{
        display: "flex",
        height: "100%",
        minHeight: 0,
        gap: 0,
      }}
    >
      {/* Left: Rendered Blocks */}
      <div
        style={{
          flex: "1 1 60%",
          overflowY: "auto",
          padding: "0",
        }}
      >
        <WaibRenderer blocks={inboxBlocks} send={send} />
      </div>

      {/* Right: Observation Log */}
      <div
        style={{
          flex: "0 0 360px",
          backgroundColor: "#1a1a2e",
          color: "#e0e0e0",
          display: "flex",
          flexDirection: "column",
          borderLeft: "1px solid #2a2a3e",
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #2a2a3e",
            fontWeight: 600,
            fontSize: "14px",
            letterSpacing: "0.5px",
            textTransform: "uppercase",
            color: "#9ca3af",
          }}
        >
          Observation Log ({observations.length})
        </div>

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "8px",
          }}
        >
          {observations.length === 0 && (
            <div
              style={{
                padding: "24px 16px",
                textAlign: "center",
                color: "#6b7280",
                fontSize: "13px",
              }}
            >
              Interact with the blocks on the left to see observations here.
            </div>
          )}

          {[...observations].reverse().map((obs, i) => (
              <div
                key={i}
                style={{
                  padding: "10px 12px",
                  marginBottom: "4px",
                  backgroundColor: "#16162a",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontFamily: "monospace",
                  lineHeight: 1.6,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span style={{ color: "#8b8ba7" }}>{obs.time}</span>
                  <span
                    style={{
                      color: obs.wasPlanned ? "#22c55e" : "#f97316",
                      fontWeight: 600,
                    }}
                  >
                    {obs.wasPlanned ? "\u2713 planned" : "\u2717 unplanned"}
                  </span>
                </div>
                <div>
                  <span style={{ color: "#7dd3fc" }}>{obs.blockType}</span>
                  <span style={{ color: "#6b7280" }}> / </span>
                  <span style={{ color: "#c4b5fd" }}>{obs.interactionType}</span>
                </div>
              </div>
          ))}
        </div>
      </div>
    </div>
  );
}
