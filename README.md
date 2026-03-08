# WaibSpace

**The AI-Native Operating Environment for the AI Web**

WaibSpace is a secure, multi-agent, AI-native operating environment that turns fragmented apps, inboxes, feeds, and workflows into one personalized, intent-driven experience. It interprets user intent across modalities, dynamically generates adaptive UI surfaces, and orchestrates connected tools through a policy-governed multi-agent system.

---

## Current State

**MVP Build Phase: 3 of 10 complete (Phases 0–2)**

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 0 — Foundation | Complete | Monorepo, types, event bus, backend/frontend scaffolds, dev tooling |
| Phase 1 — Orchestration | Complete | Orchestration kernel, agent framework, perception + reasoning agents |
| Phase 2 — Model Provider | Complete | Provider abstraction, Anthropic integration, model role config |
| Phase 3 — Policy & Trust | Next up | Policy engine, provenance, secrets management |
| Phase 4 — Connectors | Pending | Gmail, Calendar, web fetch, connector framework |
| Phase 5 — Surfaces | Pending | Surface spec system, UI agents, layout composer |
| Phase 6 — Frontend | Pending | Surface renderer, hybrid intent router, interaction capture |
| Phase 7 — Memory | Pending | Memory store, retrieval agent, update pipeline |
| Phase 8 — Background | Pending | Task scheduler, ambient surface preparation |
| Phase 9 — Demo Workflows | Pending | Email+calendar orchestration, intent URL discovery |
| Phase 10 — Polish | Pending | E2E testing, error handling, visual polish, demo prep |

### What's Running

The project **is runnable** in its current state. `bun dev` starts both the backend (port 3001) and frontend (port 5173).

**Backend** — Bun HTTP/WebSocket server with:
- Health check at `GET /health`
- WebSocket endpoint at `/ws`
- Event bus routing messages through the orchestration kernel
- 4 registered agents: input normalizer, URL intent parser, intent classifier, confidence scorer
- Anthropic model provider wired in for LLM-based intent classification

**Frontend** — React + Vite with:
- Base layout shell (header, content area, input bar)
- WebSocket hook with auto-reconnect
- Dark theme CSS foundation

**What works end-to-end today:** A WebSocket message from the frontend flows through the event bus → orchestration kernel → perception agents (normalize input) → reasoning agents (classify intent via Claude) → results emitted back. No UI surfaces are rendered yet (that's Phase 5–6).

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
# Edit .env and add your ANTHROPIC_API_KEY

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
│   └── frontend/         # React + Vite app
├── packages/
│   ├── types/            # Shared TypeScript schemas (events, surfaces, agents, policy, provenance)
│   ├── event-bus/        # Typed pub/sub event bus with wildcard support
│   ├── orchestrator/     # Orchestration kernel, agent registry, execution planner
│   ├── agents/           # Agent framework + perception & reasoning agents
│   ├── model-provider/   # LLM provider abstraction (Anthropic, OpenAI stub)
│   ├── ui-renderer-contract/  # WebSocket message protocol between backend & frontend
│   ├── connectors/       # External service connectors (Gmail, Calendar, web) — pending
│   ├── policy/           # Policy engine & trust model — pending
│   ├── memory/           # User memory & preference store — pending
│   └── surfaces/         # Surface spec builders & registry — pending
├── ARCHITECURE.md        # Full architecture document
├── MVP_PLAN.md           # Detailed MVP implementation plan
├── .env.example          # Environment variable template
└── package.json          # Bun workspace root
```

## Architecture

WaibSpace is built as an event-driven, multi-agent orchestration system:

1. **Events** flow through a typed pub/sub bus
2. **Orchestrator** routes events to agent pipelines (perception → reasoning → context → UI → safety)
3. **Agents** run in parallel within each phase, producing structured outputs
4. **Surface specs** (structured UI descriptions) are composed and sent to the frontend
5. **React renderer** dynamically renders surfaces from specs
6. **Policy engine** governs all actions by risk class (A: auto, B: standing approval, C: explicit approval)

Core principle: *Agents may interpret, propose, rank, draft, and compose. Only the execution layer may act. Only policy may authorize action.*

## Available Scripts

```bash
bun dev          # Start both backend and frontend with hot reload
bun run typecheck  # Type-check all packages
bun run dev:backend   # Backend only
bun run dev:frontend  # Frontend only
```

## Tracking

All implementation work is tracked as GitHub issues with full technical specs:
- [Open Issues](https://github.com/crcnum4/WaibSpace/issues)
- 16 of 51 tickets completed
- Issues are labeled by phase, package, role, priority, and status

## Tech Stack

- **Runtime:** Bun
- **Language:** TypeScript (strict mode)
- **Backend:** Bun.serve (HTTP + WebSocket)
- **Frontend:** React + Vite
- **LLM:** Anthropic Claude (provider-agnostic abstraction)
- **Architecture:** Event-driven, multi-agent orchestration
