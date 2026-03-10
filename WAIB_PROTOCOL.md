WAIB Protocol (Working Draft)

Overview

The WAIB Protocol defines a standardized interface for AI-native tools, data providers, and services to interact with WaibSpace agents. It provides a common framework for:
	•	Tool discovery
	•	Capability definition
	•	Economic settlement
	•	Trust verification
	•	Data provenance

The goal is to create a secure, economically sustainable, and interoperable ecosystem for AI agents and services.

⸻

1. Protocol Goals

The WAIB Protocol is designed to solve several emerging problems in the AI ecosystem.

Sustainable Data Access

Current AI systems frequently consume web data without compensating the sources that produce it. The protocol introduces economic incentives for data providers.

Secure Tool Integration

The protocol provides structured definitions that allow agents to safely interact with tools without exposing secrets or executing unsafe code.

Standardized Tool Metadata

Every WAIB-compatible tool declares its capabilities, permissions, and pricing in a structured format.

Economic Transparency

Usage of tools can trigger automated settlements using programmable smart contracts.

⸻

2. Core Concepts

Waib Tool

A Waib Tool is a structured service definition that can be invoked by WaibSpace agents.

Tools may wrap:
	•	APIs
	•	MCP servers
	•	web scraping services
	•	local compute tasks

Each tool declares its capabilities and economic model.

⸻

Capability

Capabilities define what operations a tool can perform.

Examples:
	•	search_movies
	•	retrieve_email
	•	summarize_article
	•	create_calendar_event

Capabilities allow agents to determine whether a tool can fulfill a user’s intent.

⸻

Settlement Contract

Tools may optionally reference a verified smart contract that distributes compensation to stakeholders.

These contracts define how usage payments are split across multiple parties.

⸻

Trust Metadata

Each tool includes trust metadata indicating its verification status and provider identity.

This helps WaibSpace decide whether to prefer or avoid specific tools.

⸻

3. Tool Definition Format

Example WAIB tool definition:

{
  "name": "movie_showtimes",
  "protocol": "waib-v1",

  "provider": "Apple Cinemas",

  "capabilities": [
    "search_movies",
    "list_showtimes"
  ],

  "endpoint": "https://api.applecinemas.com/waib",

  "auth": {
    "type": "oauth",
    "scopes": ["showtimes.read"]
  },

  "pricing": {
    "search_movies": 0.0002,
    "list_showtimes": 0.0003
  },

  "settlement": {
    "chain": "solana",
    "contract": "CONTRACT_ADDRESS"
  },

  "trust": {
    "verified": true,
    "provider_id": "apple_cinemas"
  }
}


⸻

4. Economic Layer

The protocol allows tools to define compensation models.

Supported payment methods may include:
	•	cryptocurrency
	•	fiat billing
	•	anonymized usage analytics
	•	data sharing agreements

This allows providers to choose economic models aligned with their business needs.

⸻

5. Usage Tracking

WaibSpace records tool invocations using structured usage events.

Example usage log:

{
  "tool": "movie_showtimes",
  "operation": "search_movies",
  "timestamp": "2026-01-01T10:00:00Z",
  "cost": 0.0002
}

Usage logs are used for:
	•	settlement
	•	auditing
	•	analytics

⸻

6. Security Model

The protocol enforces several security practices.

Secrets Isolation

Secrets such as API keys are stored in a secure vault and never exposed to AI models.

Permission Scoping

Tools declare the permissions they require.

Execution Sandboxing

Local tools may run in isolated environments.

⸻

7. Provider Incentives

By supporting the WAIB Protocol, providers gain:
	•	verified AI traffic
	•	economic participation
	•	structured analytics
	•	trusted integrations

This encourages providers to create optimized AI endpoints rather than blocking automated access.

⸻

8. Compatibility with MCP and APIs

WAIB does not replace existing systems.

Instead it acts as a standard wrapper layer around:
	•	MCP tools
	•	REST APIs
	•	GraphQL services

Existing tools can be adapted by adding WAIB metadata definitions.

⸻

9. Long-Term Vision

The WAIB Protocol may evolve into a broader ecosystem including:
	•	decentralized AI tool marketplaces
	•	data licensing networks
	•	AI-native application standards

The ultimate goal is a future where AI systems interact with the web through structured, secure, and economically sustainable interfaces rather than scraping and ad-hoc integrations.