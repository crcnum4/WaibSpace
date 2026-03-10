# WaibSpace Demo Script

## Overview

WaibSpace is an AI-native operating environment that turns fragmented apps, inboxes, feeds, and workflows into one personalized, intent-driven experience. It is not a chatbot with tools bolted on. It is a multi-agent orchestration system that interprets user intent, dynamically composes UI surfaces, and governs action through policy — all in real time.

**The core thesis:** WaibSpace proves that the next layer of the web is not another chat interface. It is an operating environment where multiple AI agents cooperate in parallel, every piece of data carries provenance, high-stakes actions require explicit approval, and the URL bar itself becomes an intent prompt.

---

## Pre-Demo Setup Checklist

### Environment

- [ ] `.env` file configured with `ANTHROPIC_API_KEY` (required)
- [ ] Gmail connected via MCP (Settings → Marketplace → Gmail — requires Google App Password)
- [ ] Dependencies installed: `bun install`

### Running Services

- [ ] Start dev servers: `bun dev`
- [ ] Backend running on http://localhost:3001 (verify: hit `/health`)
- [ ] Frontend running on http://localhost:5173
- [ ] Browser open to http://localhost:5173 with DevTools console visible (optional, for showing WebSocket events)

### Pre-Flight Verification

- [ ] Load the frontend — confirm the dark-themed UI renders with skeleton loading states
- [ ] Send a test message — confirm the agent pipeline processes it and surfaces appear
- [ ] If using live Gmail/Calendar: confirm at least one email and one calendar event exist to display

---

## Workflow 1: Email + Calendar Orchestration

### Purpose

Demonstrate the full multi-agent pipeline: from a simple user message through perception, reasoning, context gathering, UI composition, provenance annotation, and policy-gated execution.

### Step-by-Step Demo Flow

**Step 1 — Open the Application**

- Navigate to http://localhost:5173
- The home surface loads. Background tasks may have already prepared ambient surfaces.

> **SAY:** "WaibSpace is already running. Before I even typed anything, background agents have been monitoring my inbox and calendar, preparing surfaces so that when I arrive, relevant context is already here. The system was already working before you arrived."

> **POINT OUT:** Any pre-loaded surfaces from background task preparation. Skeleton loading states transitioning to real content.

---

**Step 2 — Send an Intent Message**

- Type a message like: `"Show me my emails and what's on my calendar today"`
- Submit it through the chat/input area.

> **SAY:** "I'm sending a natural language message. Watch what happens — this doesn't go to a single LLM call. It enters an event bus and flows through a pipeline of specialized agents."

> **POINT OUT:** The message triggers a WebSocket event. In the UI, skeleton loading states appear as agents begin processing.

---

**Step 3 — Agent Pipeline Processes**

- The orchestrator receives the normalized input event
- Multiple agent categories activate in sequence:
  1. **Perception agents** normalize the input
  2. **Reasoning agents** classify intent and score confidence
  3. **Context agents** determine which connectors to query (Gmail, Calendar)
  4. **UI agents** compose surface specifications for inbox and calendar views
  5. **Safety agents** annotate provenance on all data
  6. **Execution agents** stand by (no execution needed yet)

> **SAY:** "Behind the scenes, 18 agents across 6 categories are cooperating. Perception agents normalize my input. Reasoning agents classify my intent. Context agents decide what data sources to query. UI agents compose structured surface specs — not raw HTML, but typed specifications that the frontend renderer interprets. And safety agents annotate every piece of data with where it came from."

> **POINT OUT:** The pipeline runs through: normalize -> classify intent -> gather context -> compose surfaces -> annotate provenance -> render. This is not a single prompt/response — it is an orchestrated pipeline.

---

**Step 4 — Surfaces Render**

- Inbox surface appears showing email summaries
- Calendar surface appears showing today's events
- Each surface carries provenance badges

> **SAY:** "Now look at the result. I didn't get a text response — I got composed UI surfaces. An inbox surface showing my emails, a calendar surface showing my day. Each one was proposed by a specialized UI agent and composed into a layout by the layout composer agent."

> **POINT OUT:** The surfaces are structured, not free-form text. They have titles, data sections, actions, and metadata. This is the difference between a chatbot and an operating environment.

---

**Step 5 — Provenance Badges**

- Point to provenance badges on email items and calendar events
- Emails from Gmail show "trusted" provenance (OAuth-authorized connector)
- Calendar events show "trusted" provenance (OAuth-authorized connector)

> **SAY:** "Every piece of data shows where it came from. These provenance badges tell you the source, the trust level, and whether the data was fetched through an authorized connector or scraped from the web. This is how you build trust in an AI system — not by hiding the machinery, but by making it transparent."

> **POINT OUT:** Trust levels (trusted, semi-trusted, untrusted), source identifiers, and timestamps on provenance badges.

---

**Step 6 — Draft a Reply (Trigger Approval Flow)**

- Type a message like: `"Draft a reply to the first email saying I'll be there"`
- The system drafts a reply but does NOT send it automatically

> **SAY:** "Now I'm asking the system to draft a reply. Watch what happens — the system will compose the draft, but it won't send it. Sending an email is a Class C action: high-stakes, external, irreversible. The policy engine requires explicit approval."

> **POINT OUT:** The policy engine classifies this as a Class C action. The approval surface appears.

---

**Step 7 — Approval Flow**

- An approval surface appears showing the drafted email
- The user can review the content, recipient, and subject
- Click "Approve" to send, or "Reject" to discard

> **SAY:** "High-stakes actions always require approval. The system drafted the email — agents may interpret, propose, rank, draft, and compose. But only the execution layer may act, and only policy may authorize action. That's the core architectural principle. I can review exactly what will be sent, to whom, and approve or reject it."

> **POINT OUT:** The approval surface with action details. The separation between drafting (agent work) and executing (policy-gated). This is bounded autonomy, not unrestricted automation.

---

### Key Thesis Points for Workflow 1

- "This is not a chatbot with tools — it's an operating environment"
- "Agents cooperate in parallel, not sequentially"
- "Every piece of data shows where it came from"
- "High-stakes actions always require approval"
- "The system was already working before you arrived"

---

## Workflow 2: Intent URL Discovery

### Purpose

Demonstrate the AI-native routing philosophy: unknown URLs become intent prompts instead of 404 errors. This is the clearest differentiator from traditional web applications.

### Step-by-Step Demo Flow

**Step 1 — Navigate to an Intent URL**

- In the browser address bar, navigate to: `http://localhost:5173/horror-movie-tomorrow`
- Do NOT type this in the chat — type it directly in the URL bar.

> **SAY:** "Now watch this. I'm going to type something into the URL bar that is not a known page. In any traditional web application, this would be a 404 error. In WaibSpace, the URL bar becomes an intent prompt."

---

**Step 2 — Intent Resolution**

- The hybrid router detects that `/horror-movie-tomorrow` is not a known system route
- Instead of showing a 404, it passes the path to the intent system
- The orchestrator pipeline activates just like a chat message

> **SAY:** "The system recognized that this isn't a known route. Instead of failing, it treated the URL path as an intent query. The same multi-agent pipeline that handled my email request is now interpreting 'horror movie tomorrow' as a user intent."

> **POINT OUT:** No 404 page. The skeleton loading state appears as agents process the intent.

---

**Step 3 — Discovery Surface Renders**

- A discovery surface appears with results related to horror movies showing tomorrow
- Data comes from web fetch (scraping/search), possibly combined with calendar availability
- Provenance badges appear on all data items

> **SAY:** "The system gathered data from web sources and composed a discovery surface. It's showing me horror movies, showtimes, and if my calendar is connected, it even checked my availability."

> **POINT OUT:** The discovery surface type — this was dynamically generated by the UI agents, not a pre-built page.

---

**Step 4 — Provenance Contrast**

- Web-sourced data shows "untrusted" provenance (web acquisition)
- If calendar data is present, it shows "trusted" provenance (OAuth connector)

> **SAY:** "Now look at the provenance badges. The movie data scraped from the web is marked as untrusted — because it came from web acquisition, not an authorized API. But my calendar availability is marked as trusted, because it came through my OAuth-authorized Google Calendar connector. The system doesn't hide the difference — it surfaces it."

> **POINT OUT:** The contrast between untrusted (web data) and trusted (connector data) provenance badges side by side. This is the trust model in action.

---

**Step 5 — The Implication**

> **SAY:** "This is the AI-native routing philosophy. The URL bar becomes an intent prompt. You can type anything — a question, a goal, a half-formed thought — and the system will try to interpret it, gather relevant context, and compose a meaningful response surface. Traditional web apps treat unknown paths as errors. WaibSpace treats them as opportunities."

---

### Key Thesis Points for Workflow 2

- "The URL bar becomes an intent prompt"
- "Unknown paths become opportunities, not errors"
- "Every piece of data shows where it came from — and trust levels differ by source"
- "The same pipeline handles chat messages and URL intents"

---

## Talking Points Reference

Use these throughout the demo wherever they naturally fit:

| Talking Point | When to Use |
|---------------|-------------|
| "Every piece of data shows where it came from" | Whenever provenance badges are visible |
| "High-stakes actions always require approval" | During the approval flow in Workflow 1 |
| "The system was already working before you arrived" | At the start, when showing pre-loaded ambient surfaces |
| "Agents cooperate in parallel, not sequentially" | When explaining the pipeline architecture |
| "This is not a chatbot with tools — it's an operating environment" | Opening statement and closing summary |
| "The URL bar becomes an intent prompt" | During Workflow 2 |
| "Agents may interpret, propose, rank, draft, and compose. Only the execution layer may act. Only policy may authorize action." | During the approval flow, to explain the core principle |

---

## Fallback Plan: No Live Connections

If Gmail and/or Google Calendar credentials are not configured, or if live API connections fail during the demo:

### What Happens Automatically

- The connector framework gracefully handles missing credentials. The system does not crash.
- Connectors return empty data sets when credentials are absent.
- The agent pipeline still runs the full flow: perception, reasoning, context gathering (returning empty), UI composition, provenance annotation.
- Surfaces still render, but with empty or minimal data.

### What to Say

> "Even without live data connections, the architecture is fully operational. The agent pipeline ran the same way — perception, reasoning, context gathering, surface composition, provenance annotation. The connectors returned empty results because we're not connected to a live Gmail account right now, but the pipeline is identical. In production, those surfaces would be populated with real data."

### What to Point Out

- The pipeline executed all stages even without data
- Surface structures rendered (showing the spec-driven approach works regardless of data)
- Provenance badges still appear (showing the metadata layer is always active)
- The approval flow still triggers for action intents (policy enforcement is unconditional)

### For Workflow 2 (Intent URL)

- WebFetch connector will attempt to gather web data regardless of Gmail/Calendar state
- Even if WebFetch returns limited results, the discovery surface still renders with whatever was found
- The provenance contrast point still works: any web data is marked untrusted

### Pre-Caching Option

If you want guaranteed data for the demo, you can:
1. Send a few test emails to the connected Gmail account before the demo
2. Create a few calendar events for the demo day
3. Verify the data appears by running the workflows once before presenting

---

## Architecture Talking Points

For technical audiences who want to understand the system design:

### Tech Stack

- **Runtime:** Bun — chosen for speed and native TypeScript support
- **Backend:** Bun.serve with HTTP and WebSocket support, no Express overhead
- **Frontend:** React 19 + Vite — fast HMR, modern React features
- **LLM:** Anthropic Claude via provider-agnostic abstraction (OpenAI stub ready)
- **Architecture:** Event-driven, multi-agent orchestration

### Agent Pipeline

The system runs 18 agents across 6 categories:

1. **Perception Agents** — Normalize input (text, URL paths) into structured events
2. **Reasoning Agents** — Classify intent, score confidence, determine interaction semantics
3. **Context Agents** — Plan data needs, select connectors, retrieve data, check policy gates
4. **UI Agents** — Compose structured surface specifications (inbox, calendar, discovery, approval, layout)
5. **Safety Agents** — Annotate provenance metadata on all data and surfaces
6. **Execution Agents** — Execute approved actions through policy-gated connectors

### Key Design Decisions

- **Event-driven, not request/response:** The internal event bus decouples agents so they can be added, swapped, or run in parallel without changing the orchestration logic.
- **Structured surface specs, not raw UI:** Agents produce typed surface specifications. The frontend renderer interprets them. This separates data/intent from presentation.
- **Three-tier trust model:** Trusted (OAuth connectors), semi-trusted (MCP/tools), untrusted (web scraping). Trust level shapes both policy decisions and UI presentation.
- **Policy classes (A/B/C):** Class A (observe/prepare) runs freely. Class B (reversible actions) uses standing approvals. Class C (high-stakes) requires explicit approval. This creates bounded autonomy.
- **Hybrid routing:** Known system routes resolve normally. Unknown routes become intent queries. This is the AI-native routing model.

### Monorepo Structure

```
waibspace/
├── apps/backend/        → Bun HTTP/WebSocket server, orchestration wiring
├── apps/frontend/       → React + Vite, surface renderer, intent router
├── packages/types/      → Shared TypeScript schemas
├── packages/event-bus/  → Typed pub/sub with wildcard routing
├── packages/orchestrator/ → Orchestration kernel, agent registry
├── packages/agents/     → 18 agents across 6 categories
├── packages/model-provider/ → LLM provider abstraction
├── packages/connectors/ → Gmail, Calendar, WebFetch connectors
├── packages/policy/     → Policy engine, risk-class rules, approval flow
├── packages/memory/     → User memory store, auto-save, update pipeline
├── packages/surfaces/   → Surface spec builders & registry
└── packages/ui-renderer-contract/ → WebSocket message protocol
```

---

## Demo Closing

> **SAY:** "What you've seen is not a chatbot with API access. It's an operating environment where AI agents work together to interpret your intent, gather context from your connected services, compose structured UI surfaces, and govern action through policy. Every piece of data carries provenance. Every high-stakes action requires approval. And the URL bar itself becomes an intent prompt. This is what we mean by an AI-native operating environment for the AI web."
