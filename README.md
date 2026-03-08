# WaibSpace

**The AI-Native Operating Environment for the AI Web**

WaibSpace is a secure, multi-agent, AI-native operating environment that turns fragmented apps, inboxes, feeds, and workflows into one personalized, intent-driven experience. It interprets user intent across modalities, dynamically generates adaptive UI surfaces, and orchestrates connected tools through a policy-governed multi-agent system.

---

## Current State

**MVP Build: All 10 phases complete**

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 0 — Foundation | Complete | Monorepo, types, event bus, backend/frontend scaffolds, dev tooling |
| Phase 1 — Orchestration | Complete | Orchestration kernel, agent framework, perception + reasoning agents |
| Phase 2 — Model Provider | Complete | Provider abstraction, Anthropic integration, model role config |
| Phase 3 — Policy & Trust | Complete | Policy engine, risk-class enforcement, provenance tracking |
| Phase 4 — Connectors | Complete | Gmail, Google Calendar, WebFetch connectors, connector framework |
| Phase 5 — Surfaces | Complete | Surface spec system, UI agents, layout composer |
| Phase 6 — Frontend | Complete | Surface renderer, hybrid intent router, skeleton loading, error handling |
| Phase 7 — Memory | Complete | Memory store with auto-save, retrieval agent, update pipeline |
| Phase 8 — Background | Complete | Task scheduler, ambient surface preparation |
| Phase 9 — Demo Workflows | Complete | Email+calendar orchestration, intent URL discovery |
| Phase 10 — Polish | Complete | Error handling, visual polish, provenance badges, approval flow |

### What's Running

The project is fully runnable. `bun dev` starts both the backend (port 3001) and frontend (port 5173).

**Backend** — Bun HTTP/WebSocket server with:
- Full multi-agent orchestration pipeline (perception -> reasoning -> context -> UI -> safety -> execution)
- 18 registered agents across 6 categories
- Gmail, Google Calendar, and WebFetch connectors
- Policy engine with risk-class enforcement (Class A: auto, B: standing approval, C: explicit approval)
- Memory store with auto-save and update pipeline
- Background task scheduler for ambient preparation

**Frontend** — React + Vite with:
- Dynamic surface renderer for structured UI specs
- Skeleton loading states and error boundaries
- Provenance badges showing data origin and trust level
- Approval flow UI for high-risk (Class C) actions
- Intent URL resolution (unknown URLs become AI queries instead of 404s)
- Hybrid router: known system routes + intent-based catch-all
- Dark theme with responsive layout

**What works end-to-end:** A user message or URL path flows through WebSocket -> EventBus -> Orchestrator -> agent pipeline (normalize -> classify intent -> gather context -> compose surfaces -> annotate provenance -> execute approved actions) -> composed layout broadcast back to the frontend for rendering.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                │
│  React + Vite │ Surface Renderer │ Intent Router │ Approval UI  │
└──────────────────────────┬──────────────────────────────────────┘
                           │ WebSocket
┌──────────────────────────▼──────────────────────────────────────┐
│                        EVENT BUS                                │
│              Typed pub/sub with wildcard routing                 │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                    ORCHESTRATOR KERNEL                           │
│         Routes events through the agent pipeline:               │
│                                                                 │
│  ┌────────────┐  ┌───────────┐  ┌─────────┐  ┌──────────────┐  │
│  │ Perception │→ │ Reasoning │→ │ Context │→ │  UI Agents   │  │
│  │  Agents    │  │  Agents   │  │ Agents  │  │              │  │
│  └────────────┘  └───────────┘  └─────────┘  └──────────────┘  │
│        │               │             │              │           │
│        ▼               ▼             ▼              ▼           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Safety & Governance Agents                  │   │
│  └─────────────────────────┬────────────────────────────────┘   │
│                            ▼                                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │    Execution Agents (policy-gated, approval-required)    │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
         │                    │                    │
    ┌────▼────┐        ┌─────▼─────┐       ┌─────▼─────┐
    │  Gmail  │        │ Calendar  │       │ WebFetch  │
    └─────────┘        └───────────┘       └───────────┘
```

**Agent Categories:**
- **Perception** — Input normalizer, URL intent parser
- **Reasoning** — Intent classifier, confidence scorer, interaction semantics
- **Context** — Context planner, connector selection, data retrieval, memory retrieval, policy gate
- **UI** — Inbox surface, calendar surface, discovery surface, approval surface, layout composer
- **Safety** — Provenance annotator
- **Execution** — Action executor (policy-gated)

Core principle: *Agents may interpret, propose, rank, draft, and compose. Only the execution layer may act. Only policy may authorize action.*

---

## Prerequisites

- [Bun](https://bun.sh) v1.0+
- An Anthropic API key (for LLM-powered agents)

## Quick Start

```bash
# Clone the repo
git clone https://github.com/crcnum4/WaibSpace.git
cd WaibSpace

# Install dependencies
bun install

# Configure environment
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY (required)
# Optionally add Gmail/Calendar credentials for connector features

# Start development servers (backend + frontend)
bun dev
```

Backend: http://localhost:3001 (health check: `/health`)
Frontend: http://localhost:5173

## Project Structure

```
waibspace/
├── apps/
│   ├── backend/          # Bun HTTP/WebSocket server, orchestration wiring
│   └── frontend/         # React + Vite app, surface renderer, intent router
├── packages/
│   ├── types/            # Shared TypeScript schemas (events, surfaces, agents, policy, provenance)
│   ├── event-bus/        # Typed pub/sub event bus with wildcard support
│   ├── orchestrator/     # Orchestration kernel, agent registry, execution planner
│   ├── agents/           # Agent framework + 18 agents across 6 categories
│   ├── model-provider/   # LLM provider abstraction (Anthropic, OpenAI stub)
│   ├── ui-renderer-contract/  # WebSocket message protocol between backend & frontend
│   ├── connectors/       # External service connectors (Gmail, Calendar, WebFetch)
│   ├── policy/           # Policy engine, risk-class rules, approval flow
│   ├── memory/           # User memory store with auto-save, update pipeline
│   └── surfaces/         # Surface spec builders & registry
├── ARCHITECURE.md        # Full architecture document
├── MVP_PLAN.md           # Detailed MVP implementation plan
├── .env.example          # Environment variable template
└── package.json          # Bun workspace root
```

## Available Scripts

```bash
bun dev              # Start both backend and frontend with hot reload
bun run typecheck    # Type-check all packages
bun run dev:backend  # Backend only
bun run dev:frontend # Frontend only
```

## Tracking

All implementation work is tracked as GitHub issues with full technical specs:
- [Open Issues](https://github.com/crcnum4/WaibSpace/issues)
- Issues are labeled by phase, package, role, priority, and status

## Tech Stack

- **Runtime:** Bun
- **Language:** TypeScript (strict mode)
- **Backend:** Bun.serve (HTTP + WebSocket)
- **Frontend:** React 19 + Vite
- **LLM:** Anthropic Claude (provider-agnostic abstraction)
- **Architecture:** Event-driven, multi-agent orchestration
