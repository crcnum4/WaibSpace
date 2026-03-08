# WaibSpace MVP Plan

## Team Charter

WaibSpace is a secure, multi-agent, AI-native operating environment that becomes the user's primary digital interface — turning fragmented apps, inboxes, feeds, and workflows into one personalized, intent-driven experience.

This plan defines the work required to ship a functional MVP that proves the architecture thesis end-to-end.

---

## The Team

### Engineering

| Role | Handle | Responsibilities |
|------|--------|-----------------|
| **Tech Lead / Architect** | @arch | System design, orchestration kernel, event bus, overall integration |
| **Backend Engineer — Core Runtime** | @runtime | Bun server, event-driven pipeline, background tasks, WebSocket layer |
| **Backend Engineer — Agents & Orchestration** | @agents | Agent taxonomy implementation, orchestration kernel, agent lifecycle |
| **Backend Engineer — Connectors & Data** | @data | Connector layer, data retrieval, trust classification, provenance metadata |
| **Frontend Engineer — Renderer** | @renderer | React surface renderer, layout composition, component registry |
| **Frontend Engineer — Interaction & Routing** | @interaction | Hybrid router, intent URL handling, interaction semantics, multimodal input capture |
| **Platform Engineer** | @platform | Monorepo setup, CI/CD, dev tooling, Bun workspace config, shared types |

### Research & Design

| Role | Handle | Responsibilities |
|------|--------|-----------------|
| **AI/ML Research Lead** | @research | Model provider abstraction, prompt engineering, agent reasoning strategies, confidence scoring |
| **Product Designer** | @design | Surface spec UX patterns, interaction vocabulary design, adaptive layout system |
| **Policy & Trust Architect** | @trust | Policy engine design, autonomy class system, secrets management, permission flows |

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────┐
│                   React Frontend                     │
│  ┌─────────────┐ ┌──────────────┐ ┌───────────────┐ │
│  │ Hybrid      │ │ Surface      │ │ Interaction   │ │
│  │ Router      │ │ Renderer     │ │ Capture       │ │
│  └──────┬──────┘ └──────┬───────┘ └───────┬───────┘ │
└─────────┼───────────────┼─────────────────┼─────────┘
          │           WebSocket             │
┌─────────┼───────────────┼─────────────────┼─────────┐
│         ▼               ▼                 ▼         │
│  ┌──────────────────────────────────────────────┐   │
│  │              Event Bus (core)                │   │
│  └──────────────────┬───────────────────────────┘   │
│                     │                               │
│  ┌──────────────────▼───────────────────────────┐   │
│  │          Orchestration Kernel                 │   │
│  │  ┌────────┐ ┌────────┐ ┌────────┐           │   │
│  │  │ Route  │ │Schedule│ │Resolve │           │   │
│  │  │ Events │ │ Agents │ │Conflicts│          │   │
│  │  └────────┘ └────────┘ └────────┘           │   │
│  └──────────────────┬───────────────────────────┘   │
│                     │                               │
│  ┌─────────┬────────┼────────┬──────────┐          │
│  ▼         ▼        ▼        ▼          ▼          │
│ Perception Reasoning Context  UI     Safety        │
│ Agents    Agents    Agents   Agents  Agents        │
│                     │                   │           │
│              ┌──────▼──────┐    ┌──────▼──────┐    │
│              │ Connectors  │    │   Policy    │    │
│              │ (Gmail,Cal, │    │   Engine    │    │
│              │  Fetch,MCP) │    │             │    │
│              └─────────────┘    └─────────────┘    │
│                                                     │
│              Bun Backend Runtime                    │
└─────────────────────────────────────────────────────┘
```

---

## Phase 0 — Foundation (Week 1)

**Goal:** Monorepo scaffolding, shared types, event bus, and dev environment. Nothing works without this.

**Owner:** @platform, @arch

### Tasks

- [ ] **P0-1** Initialize Bun workspace monorepo with `apps/` and `packages/` structure
- [ ] **P0-2** Configure TypeScript across all packages with shared `tsconfig` base
- [ ] **P0-3** Set up `packages/types` — define core shared schemas:
  - `Event` (base event envelope: id, type, timestamp, source, payload, traceId)
  - `SurfaceSpec` (surfaceType, surfaceId, title, summary, priority, data, actions, affordances, layoutHints, provenance, confidence)
  - `AgentOutput` (agentId, agentType, output, confidence, provenance, timing)
  - `PolicyDecision` (action, riskClass, decision, reason)
  - `ProvenanceMetadata` (sourceType, sourceId, trustLevel, timestamp, freshness, transformations)
  - `ConnectorCapability` (connectorId, actions, dataTypes, trustLevel)
- [ ] **P0-4** Implement `packages/event-bus` — typed in-process pub/sub:
  - `emit(event: Event): void`
  - `on(eventType: string, handler): Unsubscribe`
  - `once(eventType: string, handler): void`
  - wildcard subscriptions for logging/tracing
  - event history buffer for debugging
- [ ] **P0-5** Scaffold `apps/backend` with Bun HTTP server + WebSocket upgrade
- [ ] **P0-6** Scaffold `apps/frontend` with React + Vite + TypeScript
- [ ] **P0-7** Dev tooling: hot reload for backend (Bun --watch), Vite HMR for frontend, single `bun dev` script
- [ ] **P0-8** Set up `packages/ui-renderer-contract` — the typed interface between backend surface composer and React renderer (shared surface spec types, WebSocket message protocol)

### Exit Criteria
- `bun dev` starts both frontend and backend
- Event bus can emit and receive typed events across packages
- Shared types importable from any package
- WebSocket connection established between frontend and backend

---

## Phase 1 — Orchestration Kernel & Agent Framework (Week 2)

**Goal:** The brain of the system. Events flow in, agents get dispatched, outputs get collected.

**Owner:** @arch, @agents, @runtime

### Tasks

- [ ] **P1-1** Implement `packages/orchestrator` — the orchestration kernel:
  - Accept normalized events from event bus
  - Maintain agent registry (which agents exist, their types, capabilities)
  - Route events to appropriate agent classes based on event type
  - Schedule parallel agent execution where independent
  - Collect and merge agent outputs
  - Emit composed results back to event bus
  - Persist traces (in-memory for MVP, structured for later persistence)
- [ ] **P1-2** Implement `packages/agents` — agent base framework:
  - `Agent` base interface: `{ id, type, category, execute(input, context): AgentOutput }`
  - Agent categories: Perception, Reasoning, Context, UI, Safety, Execution
  - Agent lifecycle: register, invoke, timeout, error handling
  - Parallel execution harness (Promise.allSettled for independent agents)
- [ ] **P1-3** Implement perception agents (MVP set):
  - `InputNormalizerAgent` — normalizes chat text, click events, URL intents into unified event shape
  - `URLIntentParserAgent` — extracts host, path segments, and intent query from URL-style inputs
- [ ] **P1-4** Implement reasoning agents (MVP set):
  - `IntentAgent` — uses LLM to classify user intent from normalized input
  - `ConfidenceScorerAgent` — scores confidence of intent classification
- [ ] **P1-5** Wire orchestration kernel into backend server event loop:
  - WebSocket message → event bus → orchestration kernel → agent dispatch → response

### Exit Criteria
- A chat message from frontend reaches backend, gets normalized, intent-classified, and a structured response flows back
- Agent execution is traced and logged
- Multiple agents run in parallel where independent

---

## Phase 2 — Model Provider Abstraction (Week 2, parallel)

**Goal:** Provider-agnostic LLM access. Anthropic default, OpenAI optional, no vendor lock-in.

**Owner:** @research

### Tasks

- [ ] **P2-1** Implement `packages/model-provider`:
  - `ModelProvider` interface: `{ complete(prompt, options): Response }`
  - `AnthropicProvider` — wraps Anthropic API (Claude as default reasoning model)
  - `OpenAIProvider` — wraps OpenAI API (optional alternative)
  - Provider selection by config or per-agent override
  - Structured output support (JSON mode / tool use)
  - Token usage tracking per request
  - Retry and error handling
- [ ] **P2-2** Define model role categories and default assignments:
  - Reasoning/planning: Claude Sonnet 4 (fast, capable)
  - Classification/intent scoring: Claude Haiku 4.5 (fast, cheap)
  - Summarization: Claude Haiku 4.5
  - UI spec generation: Claude Sonnet 4
  - Config-driven role → model mapping
- [ ] **P2-3** Integrate model-provider into agent framework so agents call models through the abstraction, never directly

### Exit Criteria
- Agents use LLMs through the provider abstraction
- Switching from Anthropic to OpenAI requires only config change
- Token usage is tracked per agent call

---

## Phase 3 — Policy Engine & Trust Model (Week 2–3)

**Goal:** The safety backbone. Nothing executes without policy approval.

**Owner:** @trust, @agents

### Tasks

- [ ] **P3-1** Implement `packages/policy`:
  - Policy rule engine with typed rules
  - Action classification into autonomy classes:
    - **Class A** (Observe & Prepare): summarize, rank, prefetch, draft, compose surfaces — auto-approved
    - **Class B** (Reversible Low-Risk): archive, snooze, save, categorize, create drafts — standing approval
    - **Class C** (High-Stakes / External): send messages, post, spend money, bookings — explicit approval required
  - `PolicyAgent` — evaluates proposed actions against rules, returns PolicyDecision
  - Approval flow: emit `policy.approval.required` → frontend renders approval UI → user responds → execution proceeds or halts
- [ ] **P3-2** Implement provenance annotation:
  - `ProvenanceAnnotatorAgent` — attaches metadata to all data and agent outputs
  - Source type, trust level, freshness, transformation chain
- [ ] **P3-3** Secrets management (MVP scope):
  - Environment-variable-backed secret store
  - Scoped access: agents request capabilities, not raw credentials
  - Connectors receive secrets at execution time only
  - No secrets in model context or conversation history

### Exit Criteria
- Every proposed action is classified by autonomy class
- Class C actions require explicit user approval before execution
- All data carries provenance metadata
- Secrets never appear in agent prompts or model context

---

## Phase 4 — Connector Layer & Data Retrieval (Week 3)

**Goal:** Connect to the real world. Email, calendar, and web data.

**Owner:** @data

### Tasks

- [ ] **P4-1** Implement `packages/connectors` — connector framework:
  - `Connector` interface: `{ id, type, trustLevel, capabilities, connect(), fetch(), execute() }`
  - Trust classification per connector:
    - Trusted Structured: OAuth-authorized APIs (Gmail, Google Calendar)
    - Semi-Trusted: MCP servers, third-party tools
    - Untrusted: fetch/scraping-based web acquisition
  - Metadata attachment on all retrieved data
- [ ] **P4-2** Gmail connector (OAuth2):
  - List/read emails
  - Search by query
  - Draft creation
  - Send (gated by Class C policy)
  - Attach provenance: source=gmail, trust=authorized, freshness=realtime
- [ ] **P4-3** Google Calendar connector (OAuth2):
  - List events for date range
  - Check availability windows
  - Create events (gated by policy)
  - Attach provenance metadata
- [ ] **P4-4** Web acquisition connector (fetch/scrape):
  - Fetch public URLs
  - Extract readable content (basic HTML parsing)
  - Trust level: untrusted by default
  - Rate limiting and timeout handling
- [ ] **P4-5** Implement context agents (MVP set):
  - `ContextPlannerAgent` — given an intent, determines what data sources are needed
  - `ConnectorSelectionAgent` — picks which connectors to invoke
  - Data retrieval execution through connector framework
- [ ] **P4-6** MCP connector scaffold (stretch):
  - Basic MCP client that can connect to local MCP servers
  - Trust level: semi-trusted
  - Capability discovery from MCP server

### Exit Criteria
- Gmail inbox can be read and summarized through the agent pipeline
- Calendar availability can be queried
- Web pages can be fetched and content extracted
- All retrieved data carries trust-level and provenance metadata

---

## Phase 5 — Surface Composition & UI Agents (Week 3–4)

**Goal:** Agents produce structured surface specs. The layout composer assembles them into a coherent UI model.

**Owner:** @agents, @renderer

### Tasks

- [ ] **P5-1** Implement `packages/surfaces` — surface spec system:
  - Surface spec builder utilities
  - Surface type registry (inbox, calendar, task, discovery, approval, generic)
  - Priority-based ordering
  - Layout hint system (width, position, prominence)
- [ ] **P5-2** Implement UI agents (MVP set):
  - `InboxSurfaceAgent` — produces inbox summary surface specs from email data
  - `CalendarSurfaceAgent` — produces calendar/availability surface specs
  - `DiscoverySurfaceAgent` — produces search/discovery result surfaces (for intent URL flow)
  - `ApprovalSurfaceAgent` — produces approval prompt surfaces for Class C actions
- [ ] **P5-3** Implement `LayoutComposerAgent`:
  - Receives multiple surface specs from UI agents
  - Resolves priority conflicts
  - Produces final composed layout with positioning
  - Emits `surface.composed` event with full UI model
- [ ] **P5-4** Implement interaction semantics foundation:
  - `InteractionSemanticsAgent` — interprets UI interactions as semantic signals
  - MVP mappings: click=select, swipe-right=dismiss, swipe-left=save, long-press=expand
  - Stored per-user (in-memory for MVP)

### Exit Criteria
- Multiple agents independently propose surface specs for the same request
- Layout composer merges them into a single coherent UI model
- Surface specs are fully typed and carry provenance
- Interaction events from frontend are interpreted semantically

---

## Phase 6 — React Frontend Renderer (Week 3–4, parallel with Phase 5)

**Goal:** The frontend renders structured surface specs into adaptive UI. Not hardcoded pages — a dynamic surface renderer.

**Owner:** @renderer, @interaction

### Tasks

- [ ] **P6-1** Implement surface renderer core:
  - Receive composed surface specs over WebSocket
  - Component registry: map `surfaceType` → React component
  - Priority-based layout rendering
  - Loading/streaming states while agents work
- [ ] **P6-2** Build MVP surface components:
  - `InboxSurface` — email list with summaries, urgency indicators, draft reply actions
  - `CalendarSurface` — availability view, event list, conflict highlighting
  - `DiscoverySurface` — search/intent results with ranked options and actions
  - `ApprovalSurface` — action approval card with context, risk level, approve/deny
  - `GenericSurface` — fallback renderer for unknown surface types (renders data as structured cards)
- [ ] **P6-3** Implement hybrid router:
  - Known routes: `/inbox`, `/calendar`, `/settings`, `/approvals`
  - Intent route catchall: any unknown path → parse as intent → send to backend as `user.intent.url_received`
  - Render intent resolution surface instead of 404
  - URL bar acts as both navigation and intent input
- [ ] **P6-4** Implement interaction capture layer:
  - Chat input → `user.message.received`
  - Click events → `user.interaction.clicked` with target context
  - Drag/swipe → `user.interaction.dragged` with direction and target
  - All interactions sent as semantic events over WebSocket
- [ ] **P6-5** Implement WaibSpace home surface:
  - Ambient landing state showing prepared surfaces (inbox summary, upcoming calendar, pending approvals)
  - Surfaces update in real-time as agents complete work
  - Chat/intent input always available
- [ ] **P6-6** Provenance display:
  - Each surface card shows source attribution (e.g., "from Gmail · authorized · 2 min ago")
  - Trust level visual indicators
  - Expandable metadata for transparency

### Exit Criteria
- Frontend dynamically renders surfaces from backend specs without hardcoded data
- Unknown URLs resolve as intent queries, not 404s
- User interactions flow back as semantic events
- Provenance is visible on every surface element

---

## Phase 7 — Memory System (Week 4)

**Goal:** The system remembers. User preferences, interaction patterns, task state.

**Owner:** @data, @agents

### Tasks

- [ ] **P7-1** Implement `packages/memory` — memory store (in-memory with JSON persistence for MVP):
  - **Profile Memory**: user preferences, tone, priorities
  - **Interaction Memory**: gesture-semantic mappings, layout preferences
  - **Task Memory**: in-progress work, pending flows, unfinished decisions
  - **System Memory**: agent decision logs, execution traces, policy outcomes
- [ ] **P7-2** Memory retrieval agent:
  - `MemoryRetrievalAgent` — pulls relevant memory context for current intent
  - Feeds into context for reasoning and UI agents
- [ ] **P7-3** Memory update pipeline:
  - After each interaction cycle, relevant memories are created/updated
  - Interaction mappings learned from user corrections
  - Emit `memory.updated` events

### Exit Criteria
- System remembers user preferences across sessions (via JSON persistence)
- Interaction semantic mappings are learned and recalled
- Agent reasoning includes relevant memory context

---

## Phase 8 — Background Tasks & Ambient Behavior (Week 4–5)

**Goal:** The system works when you're not looking. This is what makes it feel alive.

**Owner:** @runtime, @agents

### Tasks

- [ ] **P8-1** Background task scheduler:
  - Cron-style task definitions (name, schedule, allowed connectors, action class, output target)
  - Policy-scoped: each task declares its autonomy class
  - Results stored as pending surfaces for user review
- [ ] **P8-2** MVP background tasks:
  - **Morning inbox summary**: summarize email, detect urgent items, prepare draft surface
  - **Calendar conflict watch**: monitor for new conflicts, surface warnings
  - **Unanswered important messages**: identify messages from important contacts with no reply
- [ ] **P8-3** Ambient surface preparation:
  - When user opens WaibSpace, pre-prepared surfaces from background tasks are immediately available
  - Surfaces show when they were prepared and from what data
- [ ] **P8-4** Background task management UI:
  - List active background tasks
  - Enable/disable individual tasks
  - View task history and outputs
  - Transparent: user always knows what's running

### Exit Criteria
- At least one background task runs on schedule and produces a surface
- User sees pre-prepared content on arrival
- Background tasks are transparent and manageable

---

## Phase 9 — Demo Workflow Integration (Week 5)

**Goal:** Two end-to-end workflows that prove the thesis.

**Owner:** Full team

### Workflow 1: Email + Calendar Orchestration

The core productivity workflow. User opens WaibSpace and their digital life is already organized.

**Flow:**
1. Background task has already summarized inbox overnight
2. User arrives → sees inbox summary surface with urgency ranking
3. Urgent emails highlighted with calendar context ("meeting with this person in 2 hours")
4. User clicks an email → expanded view with draft reply suggested
5. Draft reply considers calendar availability ("I'm free Thursday after 2pm")
6. User approves send → Class C policy gate → approval surface → execute
7. Sent confirmation surface appears

**Proves:**
- Multi-agent orchestration (intent, context, email, calendar, UI, policy agents all cooperating)
- Structured surface rendering
- Policy-gated execution
- Ambient preparation
- Provenance-aware UI

### Workflow 2: Intent URL Discovery

The differentiator. URLs become intent prompts.

**Flow:**
1. User types `horror-movie-tomorrow` in the URL bar or chat
2. Frontend catches unresolved route → emits `user.intent.url_received`
3. Intent agent classifies: entertainment discovery + time constraint
4. Context planner identifies needs: movie listings, user location, tomorrow's date, calendar availability
5. Retrieval agents: fetch movie data (web acquisition), check calendar (trusted connector)
6. Relevance agent ranks results by: genre match, showtime fit, distance, calendar compatibility
7. UI agents produce surfaces: movie options, availability overlay, booking actions
8. Layout composer assembles final view
9. User sees a tailored decision surface — not a 404, not a generic search page

**Proves:**
- AI-native routing (unknown paths → intent resolution)
- Multi-source data retrieval with trust classification
- Structured surface composition from multiple agents
- The fundamental thesis: intent-driven, not navigation-driven

---

## Phase 10 — Polish & Demo Prep (Week 5–6)

**Owner:** Full team

### Tasks

- [ ] **P10-1** End-to-end flow testing for both demo workflows
- [ ] **P10-2** Error handling and graceful degradation (agent timeouts, connector failures)
- [ ] **P10-3** Loading states and streaming UX (show surfaces appearing as agents complete)
- [ ] **P10-4** Visual polish on surface components
- [ ] **P10-5** Demo script and walkthrough preparation
- [ ] **P10-6** Performance profiling — agent pipeline should feel responsive (target: first surface in < 3s)
- [ ] **P10-7** README and setup documentation

---

## Package Dependency Map

```
packages/types          ← no dependencies (shared foundation)
packages/event-bus      ← types
packages/model-provider ← types
packages/policy         ← types, event-bus
packages/memory         ← types, event-bus
packages/connectors     ← types, event-bus, policy
packages/agents         ← types, event-bus, model-provider, memory
packages/surfaces       ← types
packages/orchestrator   ← types, event-bus, agents, policy, surfaces
packages/ui-renderer-contract ← types, surfaces

apps/backend            ← orchestrator, event-bus, connectors, policy, memory, agents, model-provider
apps/frontend           ← ui-renderer-contract, types
```

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| OAuth complexity for Gmail/Calendar slows Phase 4 | High | Use Google API client libraries; have mock connectors ready for demo fallback |
| LLM latency makes agent pipeline feel slow | Medium | Parallelize independent agents; stream partial results; use Haiku for fast classification |
| Surface spec model too rigid or too loose | Medium | Start with 5 concrete surface types; iterate based on what agents actually produce |
| Scope creep into full platform features | High | This plan is the scope. If it's not in a phase, it's not in the MVP |
| Agent quality varies across intents | Medium | Constrain demo to the two defined workflows; prompt engineer those paths well |

---

## What Is NOT In This MVP

- Mobile / native apps
- User authentication / multi-user
- Persistent database (in-memory + JSON files for MVP)
- Voice input processing
- WaibSites ecosystem
- waibFrame as a separable framework
- Self-hosted models
- Production deployment
- Relationship memory / social graph features
- SOUL.md / ETHICS.md governance files (policy engine covers the functional need)

---

## Success Criteria

The MVP succeeds if a person can:

1. Open WaibSpace and see pre-prepared, ambient surfaces from their email and calendar
2. Interact with those surfaces to triage, draft, and approve actions
3. Type a natural-language intent into the URL bar and get a useful, structured result instead of a 404
4. See where every piece of data came from and why the system showed it
5. Feel like they are using one trusted environment, not a chatbot with tools

That is the thesis. Everything in this plan exists to prove it.
