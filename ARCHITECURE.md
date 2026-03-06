WaibSpace Architecture

Working Draft

This document defines the technical architecture for WaibSpace v0: a Bun-powered, multi-agent orchestration backend paired with a React-based frontend that renders personalized, structured UI surfaces generated from user intent, connected data, and system context.

1. Architecture Goals

WaibSpace v0 should prove the following ideas:
	•	WaibSpace is not just a chatbot with tools.
	•	The system can interpret multimodal intent signals and connected data.
	•	Multiple agents can work in parallel to gather context, reason about user needs, and propose UI surfaces.
	•	The UI can be rendered dynamically from structured surface specifications.
	•	The system can feel proactive and ambient without becoming reckless.
	•	Policy, trust, provenance, and approval flow are core parts of the architecture.

2. Core Stack Decisions

Backend
	•	Runtime: Bun
	•	Language: TypeScript
	•	Primary responsibility: orchestration kernel, agent routing, policy evaluation, connector execution, background tasks, event bus, memory, and structured surface generation

Frontend
	•	UI Framework: React
	•	Language: TypeScript
	•	Primary responsibility: render structured surface specs into adaptive UI, capture multimodal interactions, send semantic interaction events back to the backend

Routing Model

WaibSpace should not depend on conventional page-first routing as its primary interaction model.

Traditional websites treat unknown routes as errors.
WaibSpace should instead treat unknown routes as potential user intent.

That means the frontend/router layer should support a hybrid model:
	•	known system routes for trusted application surfaces
	•	intent routes for arbitrary user queries encoded in the URL

Example:
	•	/inbox
	•	/calendar
	•	/settings
	•	/horror-movie-tomorrow

If a path does not resolve to a known trusted route, WaibSpace should interpret the remaining path as an intent query and pass it into the intent system rather than returning a 404.

This creates an AI-native routing model where URLs can act as intent prompts.

3. AI-Native Routing Philosophy

WaibSpace should remove the default assumption that invalid URLs equal failure.

Instead, unknown paths become opportunities for intent interpretation.

Example Flow

User navigates to:
applecinemas.com/horror-movie-tomorrow

System behavior:
	1.	Check whether the full path maps to known structured content.
	2.	If not found, inspect whether the server response indicates a real resource miss, redirect, empty payload, or unsupported page.
	3.	Convert the trailing path into an intent query.
	4.	Route the intent into the orchestration system.
	5.	Resolve meaning using user context, location, preferences, time, connected calendar, and available site data.
	6.	Generate a results surface instead of a 404.

Possible output:
	•	nearby Apple Cinemas locations
	•	horror movies playing tomorrow
	•	showtimes matching the user’s calendar availability
	•	recommended options based on distance and preferences
	•	booking follow-up actions if available

This concept should influence both WaibSpace and future WaibSites.

4. System Overview

WaibSpace v0 is organized into five major runtime layers:

4.1 Event and Perception Layer

Receives and normalizes input from:
	•	chat
	•	voice
	•	clicks
	•	drags
	•	touch interactions
	•	URL intent paths
	•	connector events
	•	notifications
	•	background schedules

4.2 Interpretation and Context Layer

Runs specialized agents in parallel to infer intent, gather context, determine relevance, and identify ambiguity.

4.3 Orchestration and Policy Layer

Coordinates agents, manages event routing, requests data collection, checks permissions and policy, and determines what should be surfaced, drafted, or executed.

4.4 Interface Composition Layer

Collects structured surface specs from multiple agents and composes them into a coherent UI model for the frontend renderer.

4.5 Execution and Background Layer

Performs permitted actions through tools, connectors, MCP interfaces, APIs, and web acquisition paths. Also manages background tasks and audit logging.

5. Core Architectural Principle

WaibSpace should follow this rule throughout the system:

Agents may interpret, propose, rank, draft, and compose. Only the execution layer may act. Only policy may authorize action.

This principle preserves the feeling of intelligence while keeping action control explicit and governable.

6. Event-Driven Runtime

WaibSpace should be event-driven from the beginning.

The runtime should be built around an internal event bus so that agents and services do not need to be tightly coupled.

Example event types
	•	user.message.received
	•	user.voice.transcribed
	•	user.interaction.clicked
	•	user.interaction.dragged
	•	user.intent.url_received
	•	intent.inferred
	•	intent.ambiguous
	•	context.requested
	•	context.source.returned
	•	surface.proposed
	•	surface.composed
	•	policy.check.requested
	•	policy.check.result
	•	execution.requested
	•	execution.completed
	•	background.task.triggered
	•	memory.updated

Why this matters

An event-driven core makes it easier to:
	•	run multiple agents in parallel
	•	add or swap agents later
	•	debug behavior with logs and traces
	•	support ambient behavior without tight frontend coupling
	•	keep future waib ecosystem integrations flexible

7. Agent Taxonomy

WaibSpace should define clear categories of agents rather than treating every agent as the same type of thing.

7.1 Perception Agents

Responsible for normalizing input signals.

Examples:
	•	input normalization agent
	•	speech transcription adapter
	•	gesture parser
	•	URL intent parser

7.2 Reasoning Agents

Responsible for interpreting what the user is trying to do.

Examples:
	•	intent agent
	•	ambiguity detector
	•	clarification agent
	•	relevance agent
	•	confidence scorer

7.3 Context Agents

Responsible for deciding what data is needed and retrieving it.

Examples:
	•	context planner agent
	•	connector selection agent
	•	data need evaluator
	•	retrieval agents for Gmail, calendar, APIs, MCP, and scraping

7.4 UI Agents

Responsible for proposing surface specifications, not raw final UI.

Examples:
	•	inbox surface agent
	•	calendar surface agent
	•	task surface agent
	•	news surface agent
	•	discovery surface agent
	•	layout composer agent
	•	interaction semantics agent

7.5 Safety and Governance Agents

Responsible for trust, permissions, and logging.

Examples:
	•	policy agent
	•	trust evaluation agent
	•	provenance annotator
	•	audit/reflection agent

7.6 Execution Agents

Responsible for carrying out approved actions.

Examples:
	•	connector execution agent
	•	draft materializer
	•	scheduler/background task agent

8. Orchestration Kernel

WaibSpace should not use one giant “boss agent” to control the system.
Instead it should have an orchestration kernel.

Responsibilities of the orchestration kernel
	•	accept normalized events
	•	decide which agent classes to invoke
	•	schedule parallel work
	•	collect intermediate outputs
	•	resolve conflicts between agent proposals
	•	request policy checks
	•	decide whether to clarify, surface, draft, or execute
	•	manage background task triggers
	•	persist traces and state transitions

The orchestration kernel is the runtime brain of the system, but it should not directly perform external actions. It coordinates the agents that reason and the services that execute.

9. Model Provider Strategy

WaibSpace v0 should be model-provider agnostic even if Anthropic is the default initial provider.

v0 likely provider choices
	•	Primary default: Anthropic API
	•	Optional alternative: OpenAI API
	•	Future option: user-selectable provider/model
	•	Long-term option: self-hosted specialized model(s) for narrow WaibSpace tasks

Important architecture rule

The system should abstract model usage behind internal interfaces so the orchestration logic does not depend on a single vendor.

Model role categories
	•	reasoning/planning models
	•	classification and intent scoring models
	•	summarization models
	•	UI spec generation models
	•	future specialized local models

Long-term demo opportunity

A self-hosted specialized model trained or tuned for one narrow WaibSpace task could be a strong proof point.

Examples:
	•	inbox triage classifier
	•	interaction-semantic mapper
	•	risk/confidence scoring assistant
	•	surface ranking model

10. Data Source Trust Model

WaibSpace should classify all data access paths by trust level.

10.1 Trusted Structured Connectors

Examples:
	•	first-party APIs
	•	OAuth-authorized services
	•	known system integrations
	•	future waib-native protocols

Characteristics:
	•	higher trust
	•	structured schemas
	•	best suited for deterministic retrieval and action

10.2 Semi-Trusted Tool Interfaces

Examples:
	•	MCP servers
	•	third-party tools
	•	plugin-style bridges

Characteristics:
	•	useful for extensibility
	•	require capability scoping
	•	require sandboxing and provenance tracking
	•	may need approval or trust review

10.3 Untrusted Web Acquisition

Examples:
	•	fetch-based scraping
	•	HTML extraction
	•	public page parsing
	•	site fallback search

Characteristics:
	•	useful for discovery and fallback
	•	treated as untrusted input by default
	•	should not be considered authoritative without additional checks

This trust model should shape both policy and UI presentation.

11. Retrieval, Planning, and Action Separation

WaibSpace must explicitly separate three concerns:

Context Collection

Gather data from connectors and sources.

Decision and Planning

Infer meaning, determine relevance, rank options, and decide whether more context is needed.

Execution

Take permitted external actions only after policy and approval checks.

This separation improves security, observability, and debuggability.

12. Provenance and Metadata Layer

All collected data and agent outputs should carry metadata.

Metadata examples
	•	source type
	•	source identity
	•	timestamp
	•	freshness
	•	trust level
	•	confidence score
	•	whether user-authorized or scraped
	•	whether raw, summarized, inferred, or transformed
	•	related intent or event id

This metadata is essential for:
	•	personalization
	•	trust-aware ranking
	•	explainability
	•	debugging
	•	surfacing why the system showed something
	•	resolving conflicts between sources

13. Memory Architecture

WaibSpace should not treat memory as one undifferentiated store.

13.1 Profile Memory

Stores:
	•	user preferences
	•	identity hints
	•	tone/style preferences
	•	recurring priorities

13.2 Interaction Memory

Stores:
	•	gesture meanings
	•	click/drag semantic mappings
	•	preferred layout density
	•	preferred workflow patterns

13.3 Task Memory

Stores:
	•	in-progress work
	•	pending flows
	•	unfinished decisions
	•	user goals and routines

13.4 Relationship Memory

Stores:
	•	important people
	•	contact importance
	•	reply patterns
	•	social and professional continuity context

13.5 System Memory

Stores:
	•	audit logs
	•	agent decisions
	•	execution traces
	•	policy outcomes
	•	background task history

14. Structured Surface Specification Model

UI agents should produce structured surface specifications instead of raw final JSX or HTML.

Why

This makes the UI more composable, inspectable, reusable, and safe.

Surface spec responsibilities

A surface spec should describe:
	•	what kind of surface it is
	•	what data it needs or contains
	•	how important it is
	•	what actions are available
	•	what interaction affordances exist
	•	what metadata explains its origin
	•	what layout hints should influence rendering

Example surface fields
	•	surfaceType
	•	surfaceId
	•	title
	•	summary
	•	priority
	•	data
	•	actions
	•	affordances
	•	layoutHints
	•	provenance
	•	confidence

15. React Rendering Layer

The frontend should act as a structured surface renderer, not just a collection of hardcoded pages.

Rendering pipeline
	1.	Receive composed surface specs from backend.
	2.	Match each surface type to reusable React components.
	3.	Render layout using priority and layout hints.
	4.	Capture interactions and send semantic events back to the event bus.

Fallback behavior

If a surface type has no dedicated renderer yet:
	•	use a generic surface renderer
	•	or in future, pass the surface spec to an element generator agent that proposes a reusable component implementation

This creates a path from structured specs to reusable UI elements without needing raw AI-generated UI everywhere.

16. Frontend Routing Recommendation

The frontend should support a hybrid router model.

Known trusted routes

Used for stable system areas such as:
	•	settings
	•	permissions
	•	memory controls
	•	logs
	•	account connections

Intent routes

Unknown paths should become intent candidates rather than dead ends.

This means the frontend should:
	•	try known route resolution first
	•	if unresolved, pass the path to the intent router
	•	render an intent resolution surface instead of a 404

This is a meaningful architectural difference from conventional web applications and should be preserved.

17. Interaction Semantics Layer

WaibSpace should treat interaction as semantic, not just mechanical.

The same gesture may mean different things depending on:
	•	user history
	•	surface type
	•	context
	•	prior saved mappings

Example

Dragging an article to the right may mean:
	•	save for later
	•	not interested
	•	share
	•	archive

The interaction semantics layer should:
	•	infer likely meaning
	•	request clarification when needed
	•	save user-specific mappings for future use

18. Background Task System

WaibSpace should support user-permitted background tasks to preserve the feeling of ambient assistance.

Background task fields
	•	task name
	•	purpose
	•	trigger or schedule
	•	allowed connectors
	•	allowed action class
	•	output target
	•	review/expiry window
	•	policy scope

Example tasks
	•	summarize inbox every morning
	•	watch for calendar conflicts
	•	identify important unanswered messages
	•	monitor a site for specific opportunities

Background tasks should be transparent, reviewable, and policy-bound.

19. Policy and Autonomy Model

WaibSpace should use bounded autonomy rather than unrestricted automation.

Class A — Observe and Prepare

Examples:
	•	summarize
	•	rank
	•	prefetch
	•	draft
	•	compose surfaces
	•	surface recommendations

Class B — Reversible Low-Risk Actions

Examples:
	•	archive
	•	snooze
	•	save
	•	categorize
	•	create drafts
	•	add candidate tasks

Class C — High-Stakes or External Actions

Examples:
	•	send messages
	•	post publicly
	•	spend money
	•	make bookings
	•	change critical records
	•	access new protected systems

Only Class C should require explicit approval by default. Class B may use standing approvals. Class A should enable the ambient feeling of continuous preparation.

20. Secrets and Credential Handling

The model should never treat secrets as conversational memory.

Design rules
	•	secrets live in environment-backed secure stores or vaults
	•	tools receive scoped access at execution time
	•	model requests capabilities, not raw credentials
	•	outputs should be filtered to prevent secret leakage

This is a core part of making WaibSpace trustworthy.

21. Connector Layer

WaibSpace v0 should support multiple connector types.

Connector categories
	•	MCP-based connectors
	•	direct API connectors
	•	fetch/scraping-based acquisition connectors

Connector responsibilities
	•	authenticate or attach to source
	•	fetch structured or semi-structured data
	•	perform authorized actions
	•	attach metadata and provenance
	•	expose clear capability boundaries

22. Example Intent Resolution Flow

Scenario

User enters a URL-like query:
applecinemas.com/horror-movie-tomorrow

Flow
	1.	Event enters as user.intent.url_received.
	2.	Router checks known route table.
	3.	No trusted internal route matches.
	4.	URL intent parser extracts host and path query.
	5.	Context planner identifies possible retrieval needs:
	•	Apple Cinemas public site data
	•	user location
	•	tomorrow’s date
	•	movie genre filter
	•	calendar availability if permitted
	6.	Retrieval agents gather data:
	•	direct fetch and scrape from Apple Cinemas site
	•	fallback search logic if page is missing or unhelpful
	•	calendar availability window
	7.	Relevance agent ranks results by:
	•	distance
	•	fit to genre request
	•	showtimes
	•	calendar compatibility
	8.	UI agents generate surface specs:
	•	movie options surface
	•	availability fit surface
	•	suggested next action surface
	9.	Layout composer produces final UI composition.
	10.	React frontend renders results.
	11.	If booking is possible, execution remains gated by policy and approval.

23. Suggested v0 Repo Shape

/apps
  /frontend
  /backend
/packages
  /types
  /event-bus
  /orchestrator
  /agents
  /connectors
  /policy
  /memory
  /surfaces
  /model-provider
  /ui-renderer-contract

Notes
	•	types should contain shared schemas for events, surfaces, actions, provenance, and memory objects.
	•	ui-renderer-contract should define the typed interface between the backend surface composer and React renderer.
	•	model-provider should abstract Anthropic, OpenAI, and future self-hosted models.

24. Recommended v0 Priorities

To keep the demo achievable, v0 should focus on proving the system architecture through a narrow but impressive slice.

Recommended priorities
	1.	event-driven backend in Bun
	2.	provider-agnostic model abstraction with Anthropic as default
	3.	structured surface spec pipeline
	4.	React frontend renderer with hybrid known-route plus intent-route handling
	5.	one or two compelling workflows
	6.	background task support for at least one ambient use case
	7.	metadata/provenance attached throughout the pipeline

25. Recommended First Demo Workflows

Workflow 1

Email + calendar orchestration:
	•	summarize inbox
	•	detect urgent items
	•	align with availability
	•	draft replies
	•	gate send actions

Workflow 2

Intent URL discovery:
	•	user enters a natural URL path query
	•	WaibSpace interprets it as an intent
	•	retrieves data from the target site and user context
	•	generates a tailored decision surface instead of an error page

This second workflow is especially important because it demonstrates the AI-native routing philosophy and clearly differentiates WaibSpace from traditional applications.

26. Final Architecture Thesis

WaibSpace v0 should be built as a Bun-powered, event-driven, multi-agent orchestration system with a React frontend that renders structured, provenance-aware UI surfaces from user intent, connected context, and policy-governed reasoning.

Its core innovation is not merely tool access. It is the combination of:
	•	intent-native interaction
	•	ambient preparation
	•	structured multi-agent UI composition
	•	trust-aware data handling
	•	AI-native routing that turns unknown paths into meaningful user queries

That combination forms the foundation for WaibSpace as the personal operating environment of the AI web.