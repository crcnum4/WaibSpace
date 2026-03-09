/**
 * BlockInspector — Floating debug/demo panel for evaluators.
 *
 * Three tabs:
 *   - Tree: collapsible JSON-like view of the ComponentBlock tree
 *   - Observations: live feed of interaction observations
 *   - Components: registry listing of all registered block types
 *
 * Toggle with Ctrl+Shift+B or the exported BlockInspectorToggle button.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import type { ComponentBlock, BlockRegistration } from "@waibspace/types";
import { listRegisteredBlocks } from "./registry";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface BlockInspectorProps {
  blocks: ComponentBlock[];
  observations: Array<{ type: string; payload: unknown; time: string }>;
  isOpen?: boolean;
  onToggle?: () => void;
}

// ---------------------------------------------------------------------------
// Styles (inline — dev tool, no external CSS)
// ---------------------------------------------------------------------------

const PANEL_WIDTH = 400;
const BG = "#1a1a2e";
const BG_DARKER = "#16162a";
const BORDER = "#2a2a3e";
const TEXT = "#e0e0e0";
const MUTED = "#8b8ba7";
const DIMMED = "#6b7280";

const panelStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  right: 0,
  width: PANEL_WIDTH,
  height: "100vh",
  backgroundColor: BG,
  color: TEXT,
  display: "flex",
  flexDirection: "column",
  zIndex: 9999,
  fontFamily: "'Inter', system-ui, sans-serif",
  fontSize: 13,
  borderLeft: `1px solid ${BORDER}`,
  boxShadow: "-4px 0 24px rgba(0,0,0,0.4)",
};

const backdropStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  backgroundColor: "rgba(0,0,0,0.3)",
  zIndex: 9998,
};

const tabBarStyle: React.CSSProperties = {
  display: "flex",
  borderBottom: `1px solid ${BORDER}`,
  padding: "0 8px",
  gap: 0,
};

const tabStyle = (active: boolean): React.CSSProperties => ({
  padding: "10px 16px",
  cursor: "pointer",
  fontSize: 12,
  fontWeight: active ? 600 : 400,
  letterSpacing: "0.5px",
  textTransform: "uppercase",
  color: active ? "#7dd3fc" : MUTED,
  borderBottom: active ? "2px solid #7dd3fc" : "2px solid transparent",
  background: "none",
  border: "none",
  borderBottomWidth: 2,
  borderBottomStyle: "solid",
  borderBottomColor: active ? "#7dd3fc" : "transparent",
});

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "12px 16px",
  borderBottom: `1px solid ${BORDER}`,
};

const closeBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: MUTED,
  cursor: "pointer",
  fontSize: 18,
  padding: "4px 8px",
  lineHeight: 1,
};

const scrollAreaStyle: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: 8,
};

// ---------------------------------------------------------------------------
// Tree Tab — collapsible block tree view
// ---------------------------------------------------------------------------

function BlockTreeNode({
  block,
  depth,
}: {
  block: ComponentBlock;
  depth: number;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = block.children && block.children.length > 0;
  const hasProps = Object.keys(block.props).length > 0;
  const hasEvents = block.events && Object.keys(block.events).length > 0;
  const expandable = hasChildren || hasProps || hasEvents;

  // Color block type by implicit category: known primitives = blue, else orange (fallback)
  const primitiveTypes = new Set([
    "Container",
    "Text",
    "List",
    "ListItem",
    "Row",
    "Stack",
    "Button",
    "Badge",
    "Divider",
    "Expandable",
    "Grid",
    "Image",
    "TextInput",
  ]);
  const typeColor = primitiveTypes.has(block.type) ? "#60a5fa" : "#fb923c";

  return (
    <div style={{ fontFamily: "monospace", fontSize: 12 }}>
      <div
        className="block-inspector-tree-node"
        onClick={() => expandable && setExpanded(!expanded)}
        style={{
          padding: "3px 0",
          paddingLeft: depth * 16,
          cursor: expandable ? "pointer" : "default",
          display: "flex",
          alignItems: "center",
          gap: 6,
          borderRadius: 4,
          userSelect: "none",
        }}
      >
        <span style={{ color: DIMMED, width: 12, textAlign: "center" }}>
          {expandable ? (expanded ? "\u25BE" : "\u25B8") : " "}
        </span>
        <span style={{ color: typeColor, fontWeight: 700 }}>{block.type}</span>
        <span style={{ color: DIMMED }}>{block.id}</span>
      </div>

      {expanded && (
        <div style={{ paddingLeft: depth * 16 + 18 }}>
          {/* Props */}
          {hasProps && (
            <div style={{ color: MUTED, fontSize: 11, padding: "2px 0" }}>
              {Object.entries(block.props).map(([k, v]) => (
                <div key={k} style={{ paddingLeft: 8 }}>
                  <span style={{ color: "#a78bfa" }}>{k}</span>
                  <span style={{ color: DIMMED }}>: </span>
                  <span style={{ color: "#fbbf24" }}>
                    {typeof v === "string" ? `"${v}"` : JSON.stringify(v)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Events */}
          {hasEvents && (
            <div style={{ color: MUTED, fontSize: 11, padding: "2px 0" }}>
              {Object.entries(block.events!).map(([k, v]) => (
                <div key={k} style={{ paddingLeft: 8 }}>
                  <span style={{ color: "#34d399" }}>{k}</span>
                  <span style={{ color: DIMMED }}>: </span>
                  <span style={{ color: "#fbbf24" }}>
                    {JSON.stringify(v, null, 0)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Children */}
          {hasChildren &&
            block.children!.map((child) => (
              <BlockTreeNode key={child.id} block={child} depth={depth + 1} />
            ))}
        </div>
      )}
    </div>
  );
}

function TreeTab({ blocks }: { blocks: ComponentBlock[] }) {
  return (
    <div className="block-inspector-scroll" style={scrollAreaStyle}>
      {blocks.length === 0 ? (
        <div style={{ color: DIMMED, textAlign: "center", padding: 24 }}>
          No blocks to display.
        </div>
      ) : (
        blocks.map((block) => (
          <BlockTreeNode key={block.id} block={block} depth={0} />
        ))
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Observations Tab
// ---------------------------------------------------------------------------

function ObservationsTab({
  observations,
}: {
  observations: Array<{ type: string; payload: unknown; time: string }>;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [observations.length]);

  // Show newest at top
  const reversed = [...observations].reverse();

  return (
    <div ref={scrollRef} className="block-inspector-scroll" style={scrollAreaStyle}>
      {reversed.length === 0 ? (
        <div style={{ color: DIMMED, textAlign: "center", padding: 24 }}>
          No observations yet. Interact with blocks to see entries here.
        </div>
      ) : (
        reversed.map((obs, i) => {
          const p = obs.payload as Record<string, unknown> | undefined;
          const blockType = (p?.blockType as string) ?? "unknown";
          const interactionType = (p?.interactionType as string) ?? "unknown";
          const wasPlanned = (p?.wasPlanned as boolean) ?? false;

          return (
            <div
              key={reversed.length - i}
              className="block-inspector-observation"
              style={{
                padding: "10px 12px",
                marginBottom: 4,
                backgroundColor: BG_DARKER,
                borderRadius: 6,
                fontSize: 12,
                fontFamily: "monospace",
                lineHeight: 1.6,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 4,
                }}
              >
                <span style={{ color: MUTED, fontFamily: "monospace" }}>
                  {obs.time}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "1px 8px",
                    borderRadius: 4,
                    backgroundColor: wasPlanned
                      ? "rgba(34,197,94,0.15)"
                      : "rgba(249,115,22,0.15)",
                    color: wasPlanned ? "#22c55e" : "#f97316",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  {wasPlanned ? "PLANNED" : "UNPLANNED"}
                </span>
              </div>
              <div>
                <span style={{ color: "#7dd3fc", fontWeight: 700 }}>
                  {blockType}
                </span>
                <span style={{ color: DIMMED }}> / </span>
                <span style={{ color: "#c4b5fd" }}>{interactionType}</span>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Components Tab
// ---------------------------------------------------------------------------

function ComponentsTab() {
  const registrations = listRegisteredBlocks();

  const primitiveCount = registrations.filter(
    (r) => r.category === "primitive",
  ).length;
  const domainCount = registrations.filter(
    (r) => r.category === "domain",
  ).length;

  const categoryBadge = (reg: BlockRegistration): React.CSSProperties => ({
    fontSize: 10,
    fontWeight: 700,
    padding: "1px 8px",
    borderRadius: 4,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    backgroundColor:
      reg.category === "primitive"
        ? "rgba(96,165,250,0.15)"
        : "rgba(34,197,94,0.15)",
    color: reg.category === "primitive" ? "#60a5fa" : "#22c55e",
  });

  return (
    <div className="block-inspector-scroll" style={scrollAreaStyle}>
      <div
        style={{
          padding: "8px 12px",
          marginBottom: 8,
          color: MUTED,
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        {primitiveCount} primitives, {domainCount} domain
      </div>

      {registrations.map((reg) => (
        <div
          key={reg.type}
          className="block-inspector-component"
          style={{
            padding: "10px 12px",
            marginBottom: 4,
            backgroundColor: BG_DARKER,
            borderRadius: 6,
            fontSize: 12,
            lineHeight: 1.6,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 4,
            }}
          >
            <span style={{ fontWeight: 700, color: TEXT }}>{reg.type}</span>
            <span style={categoryBadge(reg)}>{reg.category}</span>
          </div>
          {reg.source && (
            <div style={{ color: MUTED, fontSize: 11 }}>
              source: {reg.source}
            </div>
          )}
          {reg.description && (
            <div style={{ color: DIMMED, fontSize: 11, marginTop: 2 }}>
              {reg.description}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Panel
// ---------------------------------------------------------------------------

type TabId = "tree" | "observations" | "components";

export function BlockInspector({
  blocks,
  observations,
  isOpen: isOpenProp,
  onToggle,
}: BlockInspectorProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("tree");

  const isOpen = isOpenProp !== undefined ? isOpenProp : internalOpen;

  const toggle = useCallback(() => {
    if (onToggle) {
      onToggle();
    } else {
      setInternalOpen((prev) => !prev);
    }
  }, [onToggle]);

  // Keyboard shortcut: Ctrl+Shift+B
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey && e.shiftKey && e.key === "B") {
        e.preventDefault();
        toggle();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggle]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="block-inspector-backdrop" style={backdropStyle} onClick={toggle} />

      {/* Panel */}
      <div className="block-inspector-panel" style={panelStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <span
            style={{
              fontWeight: 700,
              fontSize: 14,
              letterSpacing: "0.5px",
              color: "#7dd3fc",
            }}
          >
            Block Inspector
          </span>
          <button style={closeBtnStyle} onClick={toggle} title="Close (Ctrl+Shift+B)">
            ✕
          </button>
        </div>

        {/* Tab Bar */}
        <div style={tabBarStyle}>
          {(["tree", "observations", "components"] as TabId[]).map((tab) => (
            <button
              key={tab}
              className="block-inspector-tab"
              style={tabStyle(activeTab === tab)}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === "tree" && <TreeTab blocks={blocks} />}
        {activeTab === "observations" && (
          <ObservationsTab observations={observations} />
        )}
        {activeTab === "components" && <ComponentsTab />}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Toggle Button — small floating button for bottom-right corner
// ---------------------------------------------------------------------------

export function BlockInspectorToggle({
  onClick,
}: {
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      className="block-inspector-toggle"
      onClick={onClick}
      title="Block Inspector (Ctrl+Shift+B)"
      style={{
        position: "fixed",
        bottom: 16,
        right: 16,
        width: 40,
        height: 40,
        borderRadius: 8,
        backgroundColor: "#1a1a2e",
        color: "#7dd3fc",
        border: `1px solid ${BORDER}`,
        cursor: "pointer",
        fontSize: 20,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9997,
        boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
        lineHeight: 1,
      }}
    >
      {"\u229E"}
    </button>
  );
}
