# WaibSpace Master Plan v2

## Working Title
WaibSpace — The AI-Native Operating Environment for the AI Web

## One-Line Definition
WaibSpace is a secure, multi-agent, AI-native operating environment that interprets user intent across modalities, dynamically generates adaptive UI surfaces, and orchestrates connected tools through a policy-governed multi-agent system — replacing fragmented app-switching with one personalized, intent-driven experience.

---

## Executive Summary

WaibSpace is not another chatbot with tools. It is not a dashboard, a wrapper, or an AI assistant inside a chat window. It is a new interaction model: a living operating environment where the interface itself is generated from user intent, connected data, and system context.

The v0 prototype is fully operational. It demonstrates:

- **18 specialized agents** organized across 6 categories (perception, reasoning, context, UI, safety, execution) working in parallel within an orchestration pipeline
- **Structured surface composition** — agents produce typed surface specifications, not raw HTML, which a React renderer dynamically composes into adaptive layouts
- **AI-native routing** — unknown URLs become intent queries instead of 404 errors, generating tailored decision surfaces from arbitrary path input
- **Policy-governed execution** — a three-tier autonomy model (Class A/B/C) where high-stakes actions always require explicit user approval through structured approval surfaces
- **Provenance-aware data handling** — every piece of data carries metadata about its source, trust level, freshness, and transformation state, displayed to the user through provenance badges
- **Ambient background preparation** — the system summarizes inboxes, monitors calendar conflicts, and identifies unanswered messages before the user arrives
- **End-to-end connector integration** — Gmail, Google Calendar, and web acquisition connectors with OAuth authentication and graceful degradation when credentials are unavailable

The system runs on Bun with a TypeScript monorepo architecture, a React frontend, and WebSocket-based real-time surface streaming. It is a working prototype that proves the core thesis: software should adapt to the user, not the user to software.

---

## Core Vision

The modern digital experience is fragmented. Users manage dozens of apps, inboxes, feeds, and services — each with its own interface, notifications, and cognitive overhead. The dominant model assumes every service gets its own app, every workflow gets its own UI, and every action requires the user to manually navigate.

WaibSpace proposes a different model:

- **One trusted environment** instead of many disconnected tools
- **Interfaces shaped by intent** instead of fixed navigation hierarchies
- **AI that prepares, filters, drafts, and guides** instead of waiting to be asked
- **Autonomy with boundaries** instead of either full automation or manual control

The core insight is that interaction gestures are semantic signals. A click is not just a click. A drag is not just a drag. Each interaction is interpreted as an expression of intent, building a personal "interaction vocabulary" — a learned semantic language unique to each user. This reframes personalization from preference settings into a living behavioral model.

---

## What v0 Proves

### Thesis 1: Multi-agent orchestration produces better results than single-agent systems

v0 runs 18 agents across a structured pipeline. Perception agents normalize input. Reasoning agents classify intent and score confidence. Context agents plan data needs, select connectors, and retrieve data in parallel. UI agents independently compose inbox, calendar, discovery, and approval surfaces. A layout composer assembles the final view. Safety agents annotate provenance. Execution agents carry out approved actions.

This is not a chain-of-thought in a single prompt. It is genuine parallel specialization with typed inter-agent communication through structured `AgentOutput` objects.

### Thesis 2: Structured surface specs are more powerful than raw UI generation

UI agents produce `SurfaceSpec` objects — typed descriptions containing surface type, data, priority, actions, affordances, layout hints, and provenance metadata. The React renderer matches surface types to components and composes layouts from directives. This separation means:

- Surfaces are inspectable and debuggable
- New surface types can be added without changing the composition pipeline
- The same spec can drive different renderers (web, mobile, desktop)
- Layout composition is deterministic even when individual surfaces are AI-generated

### Thesis 3: AI-native routing turns navigation into intent

When a user navigates to `/horror-movie-tomorrow`, the frontend catches the unresolved route, the backend interprets the path segments as an intent query, and the full agent pipeline produces a discovery surface with ranked results — not a 404 error. The URL remains bookmarkable. Browser history works naturally. This is a meaningful architectural difference from conventional web applications.

### Thesis 4: Policy-governed execution creates trust without destroying agency

The policy engine evaluates every proposed action against glob-pattern rules with three risk classes:

- **Class A (auto-approve):** Surface composition, summarization, ranking, drafting, data fetching — ambient behaviors that feel proactive
- **Class B (standing approval):** Archive, categorize, snooze — reversible low-risk actions
- **Class C (explicit approval):** Send email, create/update calendar events, public posts — high-stakes actions that generate an approval surface overlay

Unknown actions default to Class C. The system can feel alive and helpful while maintaining strict control over consequential actions.

### Thesis 5: Provenance makes AI trustworthy

Every data source carries a `ProvenanceMetadata` object: source type, source identity, trust level (trusted/semi-trusted/untrusted), timestamp, freshness, and data state (raw/summarized/inferred/transformed). Gmail data is marked trusted. Web-scraped content is marked untrusted. Agent-generated summaries are marked as transformed. The frontend renders provenance badges on every surface, making the system's reasoning visible and auditable.

---

## Technical Architecture

### Runtime and Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Runtime | Bun | Fast TypeScript execution, native WebSocket support, built-in test runner |
| Language | TypeScript (strict mode) | Type safety across all packages |
| Backend | Bun.serve (HTTP + WebSocket) | Event processing, orchestration, connector execution |
| Frontend | React + Vite | Surface rendering, interaction capture, intent routing |
| LLM | Anthropic Claude (provider-agnostic abstraction) | Intent classification, context planning, surface generation |
| Architecture | Event-driven, multi-agent orchestration | Decoupled, parallel, traceable |

### Monorepo Structure

```
waibspace/
├── apps/
│   ├── backend/          # Bun HTTP/WebSocket server, orchestration wiring
│   └── frontend/         # React + Vite, surface renderer, intent router
├── packages/
│   ├── types/            # Shared TypeScript schemas (events, surfaces, agents, policy, provenance, memory)
│   ├── event-bus/        # Typed pub/sub with glob pattern matching, history buffer, error isolation
│   ├── orchestrator/     # Orchestration kernel, agent registry, execution planner, pipeline tracing
│   ├── agents/           # Agent framework + 18 agent implementations across 6 categories
│   ├── model-provider/   # LLM abstraction (Anthropic, OpenAI stub, role-based model selection)
│   ├── connectors/       # Gmail, Google Calendar, web fetch, MCP scaffold, connector registry
│   ├── policy/           # Policy engine with glob-pattern rules, secrets management, leak scanner
│   ├── memory/           # Categorized memory store with JSON persistence, auto-save, EventBus integration
│   ├── surfaces/         # Surface spec builders, factories, type registry with validation
│   └── ui-renderer-contract/  # WebSocket message protocol (ServerMessage/ClientMessage discriminated unions)
```

### Event-Driven Core

The system is built around a typed pub/sub `EventBus` with glob-pattern matching (e.g., `user.*` matches `user.message.received`). Events carry a `traceId` (UUID) that propagates through the entire pipeline for debugging and observability.

The EventBus provides:

- **Pattern-based subscriptions** with `on(pattern, handler)` — supports exact match and glob wildcards
- **Error isolation** — one handler failing does not block others; async rejections are caught and logged
- **History buffer** — configurable rolling history (default 1000 events) for debugging and ambient surface recovery
- **Fire-and-forget semantics** — `emit()` is synchronous; handler promises are non-blocking

This design means agents and services are fully decoupled. Adding a new agent requires only registering it with the `AgentRegistry` — no changes to the event bus or orchestrator.

### Inter-Agent Communication Protocol

Agents communicate through typed `AgentOutput` objects, not raw messages or shared state:

```typescript
interface AgentOutput {
  agentId: string;        // Which agent produced this
  agentType: string;      // Agent's type identifier
  category: AgentCategory; // perception | reasoning | context | ui | safety | execution
  output: unknown;        // Structured payload (typed per agent)
  confidence: number;     // 0-1 confidence score
  provenance: ProvenanceMetadata;  // Source, trust level, freshness
  timing: {
    startMs: number;
    endMs: number;
    durationMs: number;
  };
}
```

Each agent receives two inputs:
1. **The triggering event** (`WaibEvent`) — the original user action or system event
2. **Prior outputs** (`AgentOutput[]`) — accumulated outputs from all agents in earlier pipeline phases

This means reasoning agents can read perception outputs, context agents can read reasoning outputs, and UI agents can read all prior context. The pipeline is unidirectional — agents never write back to earlier phases, eliminating circular dependencies and race conditions.

### Orchestration Kernel

The `Orchestrator` is not a "boss agent." It is a deterministic coordinator that:

1. Accepts a normalized `WaibEvent`
2. Calls `buildExecutionPlan()` to determine which agent categories and which specific agents to invoke, based on event type
3. Executes agents **phase by phase** — within each phase, agents run in parallel via `Promise.allSettled`
4. Accumulates outputs across phases
5. Emits a `surface.composed` event with the final `ComposedLayout`
6. Logs a `PipelineTrace` with per-agent timing breakdown

#### Conflict Resolution Between Agents

Within a phase, agents operate on the same input independently. Conflicts are resolved through **composition, not competition**:

- Multiple UI agents may each produce a `SurfaceSpec`. The `LayoutComposerAgent` (which runs after other UI agents in a defined sub-phase ordering) receives all surface specs and assembles them into a `ComposedLayout` with position, width, and prominence directives.
- If agents produce contradictory confidence scores, the downstream consumer (e.g., the LayoutComposerAgent) uses priority and confidence as sorting heuristics, not as veto mechanisms.
- The orchestrator never discards agent output — all outputs propagate forward. The composition layer decides what to display.

#### Sub-Phase Ordering

Some agents within a category must execute sequentially (e.g., `ContextPlannerAgent` must run before `ConnectorSelectionAgent` which must run before `DataRetrievalAgent`). The execution planner supports explicit ordering:

```typescript
// Context agents run in three sequential sub-phases:
groups: [
  ["context.planner"],           // First: plan what data is needed
  ["context.connector-selection"], // Second: select connectors
  ["context.data-retrieval"],     // Third: execute retrieval
]

// UI agents: surface agents run in parallel, then layout composer
groups: [
  ["ui.inbox-surface", "ui.calendar-surface", "ui.discovery-surface"],
  ["layout-composer"],
]
```

Agents not mentioned in explicit orderings run in parallel with their phase. This gives fine-grained control over execution order without losing parallelism where it's safe.

#### Concurrent Event Handling

The orchestrator handles concurrent events independently. Each event gets its own `traceId`, its own pipeline execution, and its own accumulated outputs. There is no shared mutable state between concurrent pipelines. The `EventBus` dispatches events to handlers asynchronously, and each handler manages its own execution context.

### Agent Execution Harness

Every agent runs inside an `executeAgent()` harness that provides:

- **Timeout enforcement** — agents that exceed the configured timeout (default 10s) are rejected with a timeout error
- **Error isolation** — a crashing agent returns a structured error output with `confidence: 0` instead of terminating the pipeline
- **Timing measurement** — every agent output includes `startMs`, `endMs`, and `durationMs`
- **Provenance attachment** — agent outputs are automatically tagged with `sourceType: "agent"` and the agent's ID
- **Partial results** — when one agent fails, all other agents in the same phase continue executing via `Promise.allSettled`

This means the system never shows a blank screen because one agent threw an error. It degrades gracefully, rendering whatever surfaces were successfully produced.

### Pipeline Tracing and Performance

Every pipeline execution produces a `PipelineTrace` with per-phase and per-agent timing:

```
[trace:a1b2c3d4] Pipeline complete in 2340ms
  perception: 45ms (input-normalizer: 12ms, url-parser: 33ms)
  reasoning: 890ms (intent-agent: 850ms, confidence-scorer: 40ms)
  context: 650ms (context-planner: 200ms, connector-selection: 50ms, data-retrieval: 400ms)
  ui: 750ms (inbox-surface: 300ms, calendar-surface: 250ms, layout-composer: 200ms)
  safety: 5ms (provenance-annotator: 5ms)
```

Agents exceeding 1 second are flagged with `SLOW AGENT` warnings. The model provider logs request duration and token counts for LLM calls, enabling identification of bottlenecks.

Model role optimization ensures the right model for the right task:

| Role | Model | Rationale |
|------|-------|-----------|
| Classification/scoring | Haiku | Fast, cheap, sufficient for structured tasks |
| Intent analysis/reasoning | Sonnet | Balance of speed and capability |
| Surface composition | Sonnet | Needs to produce structured output reliably |
| Context planning | Sonnet | Needs to reason about data needs |

API connections are pre-warmed at startup with a lightweight ping to avoid cold-start latency on the first user request.

---

## Memory Architecture

Memory is not one undifferentiated store. The `MemoryStore` organizes entries by category:

| Category | Stores | Purpose |
|----------|--------|---------|
| `profile` | User preferences, identity hints, tone/style | Personalization |
| `interaction` | Gesture-to-meaning mappings, preferred density | Interaction vocabulary |
| `task` | In-progress work, pending flows, goals | Continuity |
| `system` | Audit logs, agent decisions, execution traces | Debugging and trust |

### Storage Architecture

Entries are keyed by `{category}:{key}` in an in-memory `Map<string, MemoryEntry>` with JSON file persistence:

```typescript
interface MemoryEntry {
  id: string;            // "profile:preferred_density"
  category: MemoryCategory;
  key: string;
  value: unknown;        // Structured data, typed per use case
  createdAt: number;     // Epoch ms
  updatedAt: number;     // Epoch ms
  source: string;        // Which agent/system wrote this
}
```

The store provides CRUD operations, text-based search, recency queries, and automatic 30-second dirty-write persistence. All mutations emit `memory.updated` events through the EventBus.

### Memory Update Pipeline

A `MemoryUpdatePipeline` listens to `surface.composed` and `user.interaction` events and automatically updates relevant memory entries — storing inbox summaries, recording interaction patterns, and tracking surface preferences. This runs passively in the background, building the user's interaction vocabulary over time.

### Scaling Memory (Future)

The current JSON persistence is appropriate for single-user prototype. The scaling path is clear:

1. **Near-term:** SQLite (via Bun's native SQLite support) for indexed queries and concurrent access
2. **Medium-term:** Vector embeddings for semantic memory search (relevant for interaction vocabulary matching)
3. **Long-term:** Per-user encrypted storage with key derivation from user credentials

The `MemoryStore` interface is already abstracted — swapping the persistence backend requires implementing `save()` and `load()`, not changing any consumers.

---

## Connector Framework

### Architecture

All connectors extend `BaseConnector`, which enforces:

- **Policy-gated execution** — the `execute()` method checks `policyDecision.verdict === "approved"` before proceeding
- **Automatic provenance** — every `fetch()` response is tagged with the connector's trust level, source type, and timestamp
- **Structured logging** — all operations log connector type, operation name, and traceId
- **Connection lifecycle** — `connect()` / `disconnect()` / `isConnected()` for graceful credential handling

### Implemented Connectors

| Connector | Trust Level | Capabilities | Auth |
|-----------|-----------|-------------|------|
| Gmail | `trusted` | List, get, search, draft, send | OAuth2 refresh token |
| Google Calendar | `trusted` | List events, check availability, create event | OAuth2 refresh token |
| Web Fetch | `untrusted` | Fetch URL, extract readable content | None (public web) |
| MCP | `semi-trusted` | Scaffold for Model Context Protocol | Capability-scoped |

### Connector Registry

Connectors register with a central `ConnectorRegistry`. Context agents query the registry to determine which connectors are available and select appropriate ones based on the retrieval plan. If a connector is unavailable (missing credentials, network error), the system continues with available data and marks affected surfaces with stale indicators.

### Trust Model in Practice

The trust classification directly influences both policy evaluation and UI presentation:

- **Trusted sources** (Gmail, Calendar): Green provenance badge, higher confidence in surface ranking, eligible for ambient background retrieval
- **Semi-trusted sources** (MCP, third-party tools): Yellow badge, require capability scoping, may need user acknowledgment
- **Untrusted sources** (web fetch): Red badge, explicitly marked as unverified, never used as sole basis for high-stakes actions

---

## Policy and Autonomy Model

### How Policy Actually Works

The `PolicyEngine` evaluates `ProposedAction` objects against a rule set:

1. Match the action type (e.g., `"email.send"`) against glob patterns in registered rules
2. Evaluate optional conditions on the action payload (equality, comparison, membership operators)
3. Return a `PolicyDecision` with verdict (`approved` | `approval_required` | `denied`), risk class, and reason

**Critical safety property:** If no rule matches an action, the engine defaults to Class C (`approval_required`). The system is safe by default — you must explicitly authorize new action types, not explicitly block them.

### Approval Flow

When a Class C action is proposed:

1. `PolicyGateAgent` evaluates the action through the PolicyEngine during the context phase
2. If `approval_required`, `ApprovalSurfaceAgent` generates an `ApprovalSurfaceSpec` with the action description, consequences, and approve/deny affordances
3. The frontend renders the approval surface as a modal overlay with clear visual hierarchy
4. User clicks approve → `policy.approval.response` event → `ActionExecutorAgent` executes the action through the appropriate connector
5. User clicks deny → action is dropped, confirmation displayed

### Default Rule Set

12 default rules cover the MVP action space:

- **Class A (5 rules):** `surface.*`, `summarize.*`, `rank.*`, `draft.*`, `fetch.*`
- **Class B (2 rules):** `archive.*`, `categorize.*`
- **Class C (4 rules):** `email.send`, `calendar.create`, `calendar.update`, `post.*`

Rules are extensible — add a new `PolicyRule` object to cover new action types as connectors are added.

---

## Frontend Architecture

### Surface Rendering Pipeline

1. Backend emits `surface.composed` event with a `ComposedLayout` (surfaces + layout directives)
2. WebSocket sends `ServerMessage` of type `surface.update` to all connected clients
3. `SurfaceRenderer` component matches each surface type to a registered component
4. Layout directives control position, width (`full` | `half` | `third`), and prominence (`primary` | `standard` | `compact`)
5. Surfaces progressively appear with staggered fade-in animations as agents complete

### Implemented Surface Components

| Surface | Purpose | Key Features |
|---------|---------|-------------|
| `InboxSurface` | Email list with urgency ranking | Urgency badges (red/yellow/blue/grey), suggested replies, send action |
| `CalendarSurface` | Event timeline | Conflict warnings, availability display |
| `DiscoverySurface` | Ranked results from intent queries | Relevance bars, provenance indicators |
| `ApprovalSurface` | Policy gate overlay | Approve/deny buttons, action description, consequence listing |
| `GenericSurface` | Fallback for unknown types | JSON renderer with provenance badge |
| `SkeletonSurface` | Loading placeholder | Shimmer animation for inbox, calendar, discovery |

### Hybrid Intent Router

The React router uses a catch-all route for unknown paths:

```
Known routes: /, /tasks, /settings, etc.
Unknown route: /horror-movie-tomorrow → IntentResolutionPage
```

The `IntentResolutionPage` captures the path, sends it as a `user.intent.url_received` event, displays a loading state with "Resolving: horror-movie-tomorrow...", and renders the resulting surfaces when they arrive. The URL stays in the address bar. Browser back/forward works naturally.

### Interaction Capture

The frontend captures user interactions semantically:

- **Click/tap** on surface elements → `user.interaction.select`
- **Swipe gestures** → detected via touch event analysis, mapped to semantic actions per surface type
- **Long press** → expansion trigger with configurable duration
- **Approve/deny** on approval surfaces → routed to `policy.approval.response` instead of generic interaction

The `InteractionSemanticsAgent` maps gesture types to likely meanings based on surface context (e.g., swipe-right on an inbox item might mean "archive" while swipe-right on a discovery result might mean "save").

---

## Background Task System

### Architecture

The `BackgroundTaskScheduler` manages interval-based tasks with:

- **Overlap prevention** — a task that hasn't finished can't be re-triggered by its interval
- **Enable/disable** — tasks can be toggled via REST API (`POST /api/tasks/{id}/toggle`)
- **Execution history** — success/failure records with timestamps
- **REST API** — `GET /api/tasks` returns status of all tasks, `GET /api/tasks/{id}/history` returns execution history

### MVP Background Tasks

| Task | Interval | Purpose |
|------|----------|---------|
| `inbox-summary` | 4 hours | Summarize recent emails, store in memory |
| `calendar-conflict-watch` | 30 minutes | Detect upcoming calendar conflicts |
| `unanswered-messages` | 2 hours | Identify emails needing responses |

### Ambient Surface Preparation

When a user connects via WebSocket, `sendPendingSurfaces()` retrieves the most recent background task results from memory and immediately sends pre-composed surfaces. The user sees relevant information before they ask for it — the system was already working before they arrived.

---

## Error Handling and Graceful Degradation

### Backend

- **Agent timeout:** Returns partial results from completed agents; timed-out agent produces structured error output with `confidence: 0`
- **Agent crash:** Isolated via `Promise.allSettled` — other agents in the same phase continue
- **Connector failure:** Surfaces render with available data; stale indicators shown on affected components
- **Unknown actions:** Default to Class C policy (approval required) rather than failing

### Frontend

- **WebSocket disconnect:** Connection banner with auto-reconnect using exponential backoff
- **Partial surfaces:** Render whatever surfaces arrive; show skeleton placeholders for expected but missing surfaces
- **Error surfaces:** User-friendly error messages mapping agent IDs to readable names; raw stack traces never shown
- **Stale indicators:** Small badges on surfaces when data couldn't be refreshed

### Design Philosophy

The system never shows a blank screen. If the LLM is slow, skeleton surfaces appear. If a connector is down, available surfaces render with a stale indicator. If an agent crashes, the other 17 agents continue. The error path produces information, not emptiness.

---

## Known Hard Problems and De-Risking Strategy

### 1. Real-time UI generation quality

**The problem:** Generating surface specs that are consistently useful requires the LLM to understand both data structure and UI semantics simultaneously.

**How we de-risk:** Surface specs are typed schemas, not free-form HTML. The LLM fills structured fields (title, priority, data, actions) — the renderer handles layout and styling. This constrains the generation space dramatically. A bad LLM response produces a surface with wrong data, not a broken UI.

**Current state:** Working. Surface agents produce valid specs for inbox, calendar, discovery, and approval surfaces.

### 2. Reliable multi-service connector integration

**The problem:** OAuth token refresh, rate limits, API changes, and credential management across multiple services.

**How we de-risk:** Connectors are isolated behind a uniform interface (`BaseConnector`). Each connector manages its own auth lifecycle. The system gracefully handles unavailable connectors — it's designed to work with zero connectors (pure LLM reasoning), one connector, or many. The fallback path is always functional.

**Current state:** Gmail and Calendar connectors implemented with OAuth2. Web fetch connector always available. Missing credentials produce a warning log, not a crash.

### 3. Interaction vocabulary learning

**The problem:** Inferring what a user means by a specific gesture in a specific context is a non-trivial personalization problem.

**How we de-risk:** v0 uses deterministic gesture-to-meaning mapping via the `InteractionSemanticsAgent` with per-surface-type lookup tables. The memory system records interaction patterns. The path to learned mappings is: accumulate interaction data in memory → analyze patterns → update mapping tables. The infrastructure exists; the ML inference layer is a future addition on top of working deterministic defaults.

**Current state:** Deterministic mapping implemented. Memory update pipeline records interactions. Learning layer is future work.

### 4. Pipeline latency under real LLM load

**The problem:** Running 18 agents with multiple LLM calls can exceed acceptable latency for interactive use.

**How we de-risk:** Agents within phases run in parallel. Model role optimization assigns fast models (Haiku) to simple tasks and capable models (Sonnet) to complex tasks. Pipeline tracing identifies bottlenecks. API connections are pre-warmed at startup. Background tasks pre-compute common surfaces so the user sees results instantly on connect.

**Current state:** Pipeline tracing implemented with per-agent timing. Slow agent warnings logged automatically. Model role config already optimized.

### 5. Coordination overhead as agent count grows

**The problem:** More agents means more coordination, more potential conflicts, and more latency.

**How we de-risk:** The orchestrator uses a phased pipeline, not a negotiation protocol. Agents don't communicate with each other — they read prior outputs and produce new outputs. This is O(n) in agent count within each phase, not O(n²). Adding an agent to a phase adds its execution time (in parallel with other agents in the phase), not a coordination tax.

**Scaling path:** If a phase becomes latency-bottlenecked, it can be split into sub-phases with explicit ordering (already supported by the execution planner). If the total pipeline is too slow, background pre-computation reduces the interactive path.

---

## Ecosystem and Extensibility

### Adding a New Connector

1. Extend `BaseConnector` with a `doFetch()` and `doExecute()` implementation
2. Set appropriate `trustLevel` in config
3. Register with `ConnectorRegistry` in the backend index
4. Add policy rules for the connector's action types
5. The existing `DataRetrievalAgent` will automatically use it if the `ConnectorSelectionAgent` selects it

No changes needed to the orchestrator, event bus, or frontend.

### Adding a New Agent

1. Extend `BaseAgent` with an `execute()` method
2. Set the agent's `category` (perception, reasoning, context, ui, safety, execution)
3. Register with `AgentRegistry` in the backend index
4. If ordering matters, add it to the `AGENT_ORDERINGS` in the execution planner
5. The orchestrator automatically includes it in the appropriate pipeline phase

### Adding a New Surface Type

1. Define the surface data interface in `packages/surfaces/src/surface-data.ts`
2. Create a React component in `apps/frontend/src/components/surfaces/`
3. Register the component in the surface component registry
4. Create a UI agent that produces the new `SurfaceSpec`

### Connector Standards

The `BaseConnector` abstraction defines a clear interface:

```typescript
interface Connector {
  id: string;
  name: string;
  type: string;
  trustLevel: TrustLevel;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  fetch(request: ConnectorRequest): Promise<ConnectorResponse>;
  execute(action: ConnectorAction): Promise<ConnectorResult>;
}
```

Third-party connectors must implement this interface, declare a trust level, and have policy rules registered for their action types. The MCP connector scaffold demonstrates how protocol-based integrations fit into this model.

### Data Portability

All user data is stored in the `MemoryStore` as JSON. The store supports `getAll(category)` for bulk export per memory category. The data format is simple key-value with timestamps and source attribution — no proprietary encoding.

---

## What WaibSpace Is Not

- **Not a chatbot with tools.** The UI is not a chat window. It is a dynamically composed surface layout generated by specialized agents.
- **Not a static dashboard.** No two sessions look the same. Surfaces are generated from current intent, available data, and user context.
- **Not a single-agent system.** 18 agents operate in parallel within a structured pipeline. Each agent has a specific role and typed output.
- **Not automation without boundaries.** Every consequential action passes through a policy engine. Unknown actions default to requiring approval.
- **Not a wrapper around existing apps.** WaibSpace generates its own interface from structured surface specs. Connectors are data sources, not embedded iframes.

---

## Implementation Status

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 0 — Foundation | Complete | Monorepo, types, event bus, backend/frontend scaffolds, dev tooling |
| Phase 1 — Orchestration | Complete | Orchestration kernel, agent framework, perception + reasoning agents |
| Phase 2 — Model Provider | Complete | Provider abstraction, Anthropic integration, model role config |
| Phase 3 — Policy & Trust | Complete | Policy engine, provenance, secrets management, leak scanner |
| Phase 4 — Connectors | Complete | Gmail, Calendar, web fetch, connector framework, MCP scaffold |
| Phase 5 — Surfaces | Complete | Surface spec system, 5 UI agents, layout composer, surface factories |
| Phase 6 — Frontend | Complete | Surface renderer, hybrid intent router, interaction capture, gesture detection |
| Phase 7 — Memory | Complete | Memory store with persistence, retrieval agent, update pipeline |
| Phase 8 — Background | Complete | Task scheduler, ambient surface preparation, task management UI |
| Phase 9 — Demo Workflows | Complete | Email+calendar orchestration, intent URL discovery — end-to-end |
| Phase 10 — Polish | Complete | E2E testing (27 tests), error handling, loading states, visual design, performance profiling |

### By the Numbers

- **51 GitHub issues** created, tracked, and completed
- **18 agents** across 6 categories
- **4 connectors** (Gmail, Calendar, Web Fetch, MCP scaffold)
- **6 surface components** + skeleton loading states
- **12 policy rules** across 3 risk classes
- **27 end-to-end tests** covering both demo workflows, error scenarios, and policy enforcement
- **12 packages** in a Bun workspace monorepo

---

## Next: v1 Roadmap

### Near-term priorities

1. **Semantic memory search** — Vector embeddings for memory retrieval, enabling "find interactions similar to this" queries
2. **Interaction vocabulary learning** — ML-based gesture-to-meaning inference from accumulated interaction data
3. **Voice input** — Speech-to-text perception agent using Whisper or equivalent, feeding into the existing intent pipeline
4. **Additional connectors** — Slack, GitHub, Notion, Google Drive — each following the existing connector interface
5. **User-defined policy rules** — Settings UI for managing policy rules, standing approvals, and notification preferences
6. **SQLite persistence** — Replace JSON file storage with Bun's native SQLite for indexed queries and concurrent access

### Medium-term direction

7. **Self-hosted classification model** — Fine-tuned model for intent classification and interaction-semantic mapping, reducing LLM latency for common operations
8. **Multi-user support** — Per-user memory stores, scoped connector credentials, session management
9. **Cross-platform** — React Native or Tauri for desktop/mobile experiences rendering the same surface specs
10. **Streaming surfaces** — WebSocket streaming of partial surface specs as agents produce them, reducing time-to-first-surface

### Long-term vision

WaibSpace becomes the trusted AI-native operating layer for how people interact with the digital world. The interface is not an app you switch to — it is the environment you live in. Every service, inbox, calendar, and workflow is a data source that feeds into your personalized, intent-driven, policy-governed operating environment.

The end state is not better app switching. The end state is a world where the user's primary interface is a dynamic AI environment that understands them, adapts to them, protects them, and helps act on their behalf.

---

## Final Thesis

WaibSpace is a working, end-to-end implementation of the AI-native operating environment: a system that interprets user intent across modalities, orchestrates 18 specialized agents in parallel, dynamically generates typed surface specifications, renders adaptive UI layouts, enforces policy-governed execution with three risk tiers, tracks data provenance from source to surface, and maintains ambient intelligence through background task preparation — all running on a Bun-powered, event-driven, TypeScript monorepo with a React frontend and real-time WebSocket communication.

It is not a concept document. It is running code.
