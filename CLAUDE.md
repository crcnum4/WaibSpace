# WaibSpace — Claude Code Instructions

## What Is WaibSpace

WaibSpace is an always-on AI agent orchestrator with a personal UI. It is NOT a dashboard, chatbot, or app with pages. Read `WAIB_SYSTEM_PLAN.md` for the full product vision.

**Key principle:** Every MCP connector expands Waib's capabilities, not its screens. There are no "pages" — only intelligent briefings, action cards, and proactive alerts.

## Git Workflow

- **Never commit directly to main.** Always create a feature branch.
- Create a GitHub issue to track work when appropriate, then open a PR to merge.
- Use conventional commit messages (fix:, feat:, chore:, etc.).

## Tech Stack

- **Runtime:** Bun
- **Monorepo:** Turborepo
- **Frontend:** React + Vite, CSS custom properties + BEM (no Tailwind)
- **Backend:** Bun + WebSocket
- **Database:** SQLite (memory stores)
- **AI:** Claude API via model-provider package
- **Connectors:** MCP servers (plug-and-play, no hardcoding per service)

## Key File Paths

- Backend entry: `apps/backend/src/index.ts`
- Frontend entry: `apps/frontend/src/main.tsx`
- Frontend home: `apps/frontend/src/pages/HomePage.tsx`
- Block renderer: `apps/frontend/src/blocks/WaibRenderer.tsx`
- Block registration: `apps/frontend/src/main.tsx` (registers before first render)
- Surface agents: `packages/agents/src/ui/`
- Orchestrator: `packages/orchestrator/src/orchestrator.ts`
- Execution planner: `packages/orchestrator/src/execution-planner.ts`
- Memory system: `packages/memory/src/`
- Connectors: `packages/connectors/src/`
- MCP catalog: `packages/connectors/src/mcp/catalog.ts`
- Policy engine: `packages/agents/src/context/policy-gate.ts`
- System plan: `WAIB_SYSTEM_PLAN.md`

## Architecture

- **Pipeline:** perception → reasoning → context → UI → safety
- **Agents** are pure functions: receive AgentInput + AgentContext, return AgentOutput
- **Surfaces** are data specs (SurfaceSpec) transformed into ComponentBlocks by frontend transformers
- **MCP connectors** are discovered dynamically — tools are not hardcoded per service
- **Block registration** happens in `main.tsx` before ReactDOM.createRoot (NOT in useEffect)

## Phase-Based Development Process

WaibSpace development follows a phased approach defined in `WAIB_SYSTEM_PLAN.md`. Each phase follows this workflow:

### Phase Execution Workflow

1. **Start of Phase:** Read `WAIB_SYSTEM_PLAN.md` to understand the current phase's goals and tasks.

2. **Issue Creation:** Spin up agents in parallel to create GitHub issues for each task in the current phase. Each issue should be well-scoped with clear acceptance criteria.

3. **Development:** Assign agent teams to work on issues in parallel where possible:
   - **Developer agents** work in isolated worktrees, one issue per agent
   - **QA agent** reviews each PR for correctness, test coverage, and alignment with `WAIB_SYSTEM_PLAN.md`
   - **Senior agent** does final review, resolves merge conflicts between PRs, and merges to main

4. **Phase Completion:** When all issues in a phase are merged:
   - Mark the phase as complete in `WAIB_SYSTEM_PLAN.md` (add ✅ and completion notes)
   - Evaluate results — did anything change about the system that affects future phases?
   - Update remaining phases in `WAIB_SYSTEM_PLAN.md` based on learnings
   - Document any architectural decisions or patterns discovered

5. **Next Phase:** Repeat from step 1 with the next phase.

### Current Phase Status

Check `WAIB_SYSTEM_PLAN.md` → "Implementation Sequence" section for the current phase and progress.

### Important Reminders

- Always read `WAIB_SYSTEM_PLAN.md` before starting work — it's the north star
- Connectors expand capabilities, NOT screens — never build "pages" for a data source
- AI always triages — no raw data dumps to the user
- The three-tier memory model (short/mid/long-term with domain scoping) is the target architecture
- Trust tiers govern autonomous actions: Auto → Low-risk → Medium → High

## MCP Mail Server Known Issue

The `mcp-mail-server` npm package returns broken email data:
- `from`: empty string `""`
- `subject`: literal `"No Subject"` for most emails
- `to`: empty string `""`
- `text`: raw MIME content with headers embedded in body
- `html`: `false` (boolean, not HTML string)

This is an upstream bug in the MCP server's email parsing. The raw email data (6MB for 136 emails) includes From/Subject in the MIME body text but fails to extract them into proper fields. This needs to be fixed or the server needs to be replaced (Phase 1 task).
