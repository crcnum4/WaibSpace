# WaibSpace System Plan

## What Is Waib?

Waib is an always-on AI agent orchestrator with a personal UI. It is not a dashboard. It is not a chatbot. It is not an app with pages.

Waib is a **chief of staff** that:
- Monitors your data sources continuously (email, Slack, calendar, social media, etc.)
- Makes autonomous decisions within trust boundaries you define
- Surfaces only what needs your attention, when it needs your attention
- Takes action on your behalf and reports what it did
- Learns your preferences over time to reduce interruptions

The UI is Waib's mouth — how it communicates with you. It is not a window into your data. You already have Gmail, Slack, and Calendar for that.

## Core Principles

### 1. Connectors Expand Capabilities, Not Screens

Adding a Gmail MCP doesn't create an "Inbox page." It gives Waib the ability to understand, triage, and act on your email.

Adding a GitHub MCP doesn't create a "Repos page." It gives Waib the ability to review PRs, take issues, and spin up coding agents.

Adding a Slack MCP doesn't create a "Messages page." It gives Waib the ability to monitor conversations, auto-reply when appropriate ("I'll loop Cliff into this"), and surface threads that need your input.

Adding an API to AppleCinemas gives Waib the ability to find showtimes when you mention wanting to see a movie. Adding a restaurant API lets Waib find baked fish near you when you're hungry.

**Every connector is a new skill, not a new screen.**

### 2. AI Always Triages

There is no "raw data" view. Waib always processes incoming data through its intelligence pipeline before surfacing anything. The user never manually scans a list — Waib scans, classifies, and presents what matters.

For email:
- Pull recent messages → classify (promotional, informational, actionable, personal, professional)
- Promotional → auto-mark read, store deal summary in memory ("10% off shoes from Old Navy, expires 3/20/26")
- Informational → extract key facts, dismiss or store
- Actionable → surface with context, suggested action, urgency level
- Auto-recommend unsubscribing from irrelevant promo lists

For Slack:
- Monitor channels and DMs → detect messages requiring user attention
- Auto-reply to mentions when appropriate ("I'll loop Cliff into this as soon as I can")
- Surface a briefing block explaining what happened, what Waib thinks the response should be, allow user to edit or approve

For Calendar:
- Cross-reference with email and Slack for meeting prep
- Detect conflicts, suggest resolutions
- Prep briefing cards before meetings
- generate new meetings or block off time based on other data sources.
- send reminders through email connector to other attendees to reduce no shows.

For GitHub:
- Monitor assigned PRs and issues
- Summarize code changes for review
- Take issues if given permission
- Spin up a coding agent for implementation tasks

### 3. Trust Tiers for Autonomous Action

Waib operates within a trust framework. Users configure how much autonomy Waib has, and Waib earns more trust over time through successful actions and positive feedback.

| Tier | Approval | Examples |
|------|----------|----------|
| **Auto** | No approval needed | Mark email as read, categorize messages, store promo summaries in memory, extract facts from informational emails |
| **Low-risk** | Notify after action | Unsubscribe from irrelevant promo email lists, file informational emails, auto-reply to Slack mentions with status updates |
| **Medium** | Approve first, trainable | Reply to emails, respond to Slack threads. Starts requiring approval. User can create rules to auto-approve certain senders/topics/patterns. Waib reports what it did and accepts feedback to improve. |
| **High** | Always approve | Send new emails, delete data, external side effects with no undo, financial transactions |

**Trust is trainable:**
- User approves a reply to their boss → Waib notes the pattern
- After N approvals for similar actions → Waib suggests: "I've drafted 5 replies to [boss] that you approved without changes. Want me to auto-send similar replies?"
- User can always revoke trust at any level
- Waib always reports actions taken and invites feedback

### 4. Always-On System

Sessions don't exist. Waib runs continuously. The UI is just a window into what Waib is doing.

**When UI is open:**
- Real-time briefing of what needs attention
- Proactive alerts when important events occur (urgent email, Slack mention, calendar conflict)
- User can interact, give instructions, approve actions

**When UI is closed:**
- Background agents continue polling data sources on configured intervals
- Autonomous actions within trust boundaries continue executing
- Memory accumulates insights and patterns
- When UI reopens: "While you were away..." briefing

**Periodic polling:**
- Each connector has configurable poll intervals (email every 5 min, Slack every 1 min, calendar every 15 min)
- Important events can trigger immediate processing (webhooks where available)
- Force briefing card to screen when high-urgency item detected

### 5. Creative UI, Not Chatbot

Waib is not a chat interface. The UI is dynamic and personalized.

**Component library:** Waib has a collection of React components for building interfaces — briefing cards, action cards, timelines, summaries, data visualizations, approval flows, etc.

**Dynamic composition:** Waib composes UI from components based on what it needs to communicate. No fixed layout. No pages. The home screen might show:
- A briefing card summarizing 3 urgent items
- An action card where Waib drafted a reply and needs approval
- A notification that Waib unsubscribed from 2 promo lists
- A timeline of what happened while you were away

**Not restricted:** Waib should not be limited to existing components. If Waib determines it needs a new way to display data (a timeline, a comparison view, a Kanban board), it can flag this need or spin up a parallel task to create the component.

**Personalized:** The layout adapts to the user. Heavy email users see email intelligence prominently. Developers see GitHub activity. The engagement tracker already supports this — surfaces that get interaction get promoted.

## Architecture Alignment

### What Already Exists and Aligns

| Component | Status | Notes |
|-----------|--------|-------|
| Event-driven orchestrator | Exists | Pipeline: perception → reasoning → context → UI → safety |
| Agent pipeline with phases | Exists | Agents are pure functions, composable |
| Memory system | Exists | Contact profiles, behavioral learning, pattern detection, engagement tracking |
| Policy gate with risk classes | Exists | Separates auto/low/medium/high risk actions |
| Action executor with approval flow | Exists | User approves → action executes |
| Layout composer | Exists | Engagement-adaptive, supports overlay/primary/secondary positioning |
| MCP connector abstraction | Exists | Tools discovered dynamically, no hardcoding per service |
| Provenance/trust tracking | Exists | Every output carries trust metadata |
| Behavioral model | Exists | Learns user preferences from observations |

### What Needs to Change

| Component | Change | Priority |
|-----------|--------|----------|
| **InboxSurfaceAgent** | Rewrite as TriageAgent — classifies, acts, surfaces only what matters. Not email-specific; pattern applies to all connectors. | High |
| **Background scheduler** | Build a task scheduler that polls connectors on intervals and triggers pipeline runs without user events. | High |
| **Gmail-clone UI components** | Remove GmailInboxList, GmailEmailCard as default views. Replace with BriefingCard, ActionCard, InsightCard patterns. Domain components become detail views (on-demand). | High |
| **Agent spawning** | Allow agents to request spawning sub-agents or parallel tasks (e.g., "build a new component", "run a coding agent"). Orchestrator mediates. | Medium |
| **Memory-driven actions** | Connect memory insights to autonomous actions (e.g., stored promo pattern → auto-unsubscribe recommendation). | Medium |
| **Trust training loop** | Track approval patterns → suggest trust escalation → user confirms → auto-approve similar future actions. | Medium |
| **MCP mail server** | Fix or replace — current `mcp-mail-server` returns empty from/subject fields and raw MIME in text body. | High |
| **Proactive alerts** | Push briefing cards to UI when high-urgency items detected (WebSocket already exists). | Medium |
| **Component generation** | Allow Waib to flag "I need a component that doesn't exist" and potentially generate it. | Low (future) |

### What to Kill

- **GmailInboxList as default home view** — Waib doesn't show you your inbox
- **"WaibScan" as opt-in** — the AI always triages, that's the point
- **Per-service page patterns** — no "inbox page", "calendar page", "slack page"
- **Raw data dump surfaces** — user never sees unprocessed connector output
- **The concept of "sessions"** — Waib is always on

## The Briefing Model

Instead of pages, Waib communicates through **briefings** — intelligent summaries of what matters right now.

### Initial Load Briefing
When the user opens WaibSpace:
```
"Good morning, Cliff. Here's what needs your attention:

[ActionCard] Your boss replied to the Q4 report thread — wants numbers
by EOD. I drafted a reply. [Review] [Send] [Dismiss]

[ActionCard] Sarah in #engineering asked about the API migration.
I replied: 'I'll loop Cliff in shortly.' She's waiting for your input.
[View Thread] [Draft Reply]

[InsightCard] 7 promotional emails handled — 2 deals saved to memory
(Old Navy 10% off expires 3/20, AWS credits expire 4/1).
Recommended unsubscribing from 3 lists. [Review] [Approve All]

[CalendarCard] You have 3 meetings today. 30 min gap at 2pm.
No conflicts detected.
"
```

### Proactive Alert
When something urgent arrives while the user has the UI open:
```
[OverlayCard — High Priority]
"Urgent email from your client at 2:47 PM — contract review deadline
is tomorrow. I've pulled the attachment and summarized the key changes.
[View Summary] [Draft Reply] [Remind Me Later]"
```

### Background Report
When the user reopens after being away:
```
"While you were away (2 hours):
- Replied to 2 Slack messages on your behalf (approved patterns)
- Filed 12 emails (3 actionable queued for your review)
- Your 3pm meeting was cancelled by the organizer
- GitHub: 2 PRs assigned to you for review
[Show Details]"
```

## Memory Architecture

Waib needs intelligent memory that scales over months of continuous use without bloating context windows or losing important information. The memory system uses three tiers with contextual scoping.

### Three-Tier Memory Model

#### Short-Term Memory
**What:** Detailed, task-specific working memory. The scratch pad for whatever Waib is doing right now.

- Scoped to a specific task or agent run
- A coding agent gets a scratch space filled with file analysis — deleted on completion
- The email triage agent gets detailed notes about the current batch — compacted when done
- Also holds the "hot" conversation context (last few user interactions)
- **Lifecycle:** Created on task start, destroyed on task end or after configurable TTL
- **Size:** Unconstrained within the task — it's temporary
- **Prompt inclusion:** Always included for the active task's LLM calls

#### Mid-Term Memory
**What:** Waib's working model of "what I know right now." Compact summaries of things that keep coming up.

- Promoted from short-term when patterns repeat (3+ occurrences across runs)
- Compacted: not raw data, but refined insights ("Cliff's boss expects EOD replies," "PR reviews are usually requested Mon/Wed")
- Has a **decay score** — entries that aren't accessed or reinforced lose relevance over time
- Periodically pruned: low-relevance items get demoted to a long-term keyword blurb
- **Size target:** Small enough to selectively include in LLM calls (~2-4K tokens of relevant context)
- **Prompt inclusion:** Filtered by domain scope before injection (see Contextual Scoping below)

#### Long-Term Memory
**What:** Keyword-indexed knowledge base. Survives months of inactivity. The reason Waib remembers Mark Doe after 6 months of silence.

Each entry:
```
{
  keywords: ["mark doe", "acme corp", "contract", "Q4"],
  blurb: "Client contact at Acme Corp. Discussed Q4 contract renewal. Prefers email over Slack. Direct communicator.",
  domain: "contacts:professional",
  lastAccessed: "2025-09-15",
  createdAt: "2025-06-02",
  sourceContext: "email triage + 3 conversation threads"
}
```

- Searched via keywords/FTS when triggers match (name mentioned, topic arises)
- Never automatically deleted — only user-initiated or extreme staleness (configurable)
- Cheap to store (SQLite rows), expensive only when pulled into active context
- **Prompt inclusion:** On-demand. When Waib processes new data, it runs a keyword search against long-term. Matching blurbs get injected into the current context.

### The Compaction Flow

```
Short-term (detailed, ephemeral, task-scoped)
    ↓ task complete or periodic sweep
    ↓ LLM summarizes: "what's worth remembering from this run?"
    ↓ repeated patterns get promoted
Mid-term (summaries, active knowledge, domain-scoped)
    ↓ relevance decay over time
    ↓ periodic prune: extract keywords + blurb for items going cold
Long-term (keyword-indexed, searchable, permanent)
    ↑ recalled on-demand when keywords match current context
```

Compaction runs as a background task during idle time. It costs LLM tokens but is what makes Waib genuinely intelligent over time rather than stateless.

### Contextual Scoping

Memory isn't one global blob. It's **domain-scoped** so the right context loads for the right task.

**Domains** are derived from the active connector, topic, or task type:

| Domain | Short-term example | Mid-term example | Long-term example |
|--------|-------------------|------------------|-------------------|
| `email:personal` | "Wife sent tax docs, needs review by Friday" | "Tax season: Cliff and wife file jointly, use TurboTax" | "Wife: Sarah, prefers text for urgent items" |
| `email:professional` | "Boss wants Q4 numbers EOD" | "Boss expects same-day replies, prefers bullet points" | "Mark Doe, client at Acme Corp, contract renewal" |
| `github:dev` | "PR #290 changes data-retrieval.ts, inbox-surface.ts" | "WaibSpace uses BEM CSS, no Tailwind, bun for runtime" | "Project started June 2025, monorepo with turborepo" |
| `slack:work` | "#engineering thread about API migration, Sarah waiting" | "Sarah = engineering lead, usually asks Cliff about backend" | "Company uses Slack for async, email for formal" |
| `calendar` | "3 meetings today, 30min gap at 2pm" | "Cliff blocks Friday afternoons, avoids early Monday" | "Recurring 1:1 with boss every Tuesday 10am" |

**How scoping works in practice:**
- When triaging email from Cliff's wife about taxes → load `email:personal` mid-term + search long-term for tax-related entries
- When a coding agent runs on WaibSpace → load `github:dev` mid-term. Don't load Slack gossip or tax details.
- When processing a Slack message from Sarah → load `slack:work` mid-term + search long-term for "Sarah"
- **Cross-domain is allowed** when context demands it: email mentions a meeting → pull `calendar` context too

**Domain inheritance:** Some mid-term knowledge is "global" — user preferences, communication style, timezone. These load regardless of domain. Scoping filters out the irrelevant, not the universally useful.

### Memory vs Current System

| Current | Three-Tier Model |
|---------|-----------------|
| MemoryStore: flat key-value, permanent, no decay | Long-term: keyword-indexed, searchable, with staleness tracking |
| ContactProfileStore: every sender forever, same weight | Contacts live across tiers: active contacts in mid-term, dormant in long-term with keyword blurb |
| ConversationContextStore: per-session, then gone | Short-term: per-task, compacted to mid-term on completion |
| BehavioralModel: accumulates forever, no pruning | Patterns promoted to mid-term, refined over time, stale ones decay |
| No domain scoping | Domain-scoped at mid-term and short-term level |
| Everything or nothing in context | Selective injection: short-term always, mid-term filtered by domain, long-term searched on-demand |

### Cost Considerations

- **Short-term:** Free to create/destroy. Lives in memory or temp files during task execution.
- **Mid-term:** Small SQLite table. Compaction from short→mid costs ~1 LLM call per task completion (background, not user-blocking).
- **Long-term:** SQLite with FTS index. Compaction from mid→long costs ~1 LLM call per pruning cycle (weekly or configurable).
- **Recall:** Keyword search against long-term is a SQLite FTS query — near-instant, no LLM cost. Only costs tokens when blurbs are injected into context.

The total memory overhead is a few background LLM calls per day for compaction. This is the cost of Waib getting smarter over time.

## Implementation Sequence

### Phase 1: Foundation ✅ Complete
1. ~~Fix MCP mail server data issue~~ — PR #298: MIME header extraction + field normalization, body-only truncation
2. ~~Fix block registration timing~~ — Moved to main.tsx before createRoot (commit 9bceffb)
3. ~~Remove debug console.log~~ — Only on feature branch, never reached main
4. ~~Build background task scheduler~~ — PR #299: TaskScheduler with exponential backoff, system.poll event type

### Phase 2: Three-Tier Memory
1. Implement short-term memory with task-scoped lifecycle (create on task start, destroy on complete)
2. Implement mid-term memory with domain scoping and decay scores
3. Implement long-term memory as keyword-indexed SQLite FTS table
4. Build compaction pipeline: short→mid (on task complete), mid→long (periodic prune)
5. Wire memory tiers into agent context — selective injection based on domain relevance

### Phase 3: Triage Intelligence
1. Rewrite InboxSurfaceAgent as a generic DataTriageAgent pattern
2. LLM always classifies incoming data (not opt-in)
3. Auto-actions for low-risk tier (mark read, categorize, store in memory)
4. Memory integration — promo summaries to mid-term, contact patterns to long-term
5. Apply triage pattern to other connectors as they're added (Slack, GitHub, Calendar)

### Phase 4: Briefing UI
1. Create BriefingCard, ActionCard, InsightCard, StatusCard components
2. Rewrite LayoutComposer to produce briefings instead of surface grids
3. Proactive overlay alerts via WebSocket push for high-urgency items
4. "While you were away" summary generation from accumulated short-term logs

### Phase 5: Trust Training
1. Track approval/rejection patterns per action type per domain
2. Suggest trust escalation after N consistent approvals
3. User-defined rules ("always reply to my boss with acknowledgment")
4. Feedback loop — user corrects autonomous action → adjusts mid-term memory + trust model

### Phase 6: Expanded Capabilities
1. Agent spawning for parallel tasks (coding agents, research agents)
2. Component generation pipeline — Waib can request or create new UI components
3. Multi-connector cross-referencing (email mentions meeting → pull calendar + Slack context)
4. Autonomous workflows (GitHub issue → coding agent → PR → review request)
5. Long-term memory recall in conversation ("remember Mark Doe?" → FTS search → context injection)
