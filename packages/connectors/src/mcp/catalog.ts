import type { TrustLevel } from "@waibspace/types";

export interface MCPCredentialSpec {
  key: string;
  label: string;
  helpText: string;
  helpUrl?: string;
  sensitive: boolean;
}

export interface MCPServerTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  npmPackage: string;
  command: string;
  args: string[];
  requiredCredentials: MCPCredentialSpec[];
  defaultEnv?: Record<string, string>;
  categories: string[];
  trustLevel: TrustLevel;
}

export const MCP_SERVER_CATALOG: MCPServerTemplate[] = [
  {
    id: "github",
    name: "GitHub",
    description:
      "Manage repositories, issues, pull requests, and code reviews",
    icon: "💻",
    npmPackage: "@modelcontextprotocol/server-github",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-github"],
    requiredCredentials: [
      {
        key: "GITHUB_PERSONAL_ACCESS_TOKEN",
        label: "GitHub Personal Access Token",
        helpText:
          "Create a token at GitHub Settings → Developer settings → Personal access tokens → Tokens (classic). Select the scopes you need (repo, read:org recommended).",
        helpUrl: "https://github.com/settings/tokens",
        sensitive: true,
      },
    ],
    categories: ["development", "code"],
    trustLevel: "semi-trusted",
  },
  {
    id: "filesystem",
    name: "Filesystem",
    description: "Read, write, and manage files on your computer",
    icon: "📁",
    npmPackage: "@modelcontextprotocol/server-filesystem",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem"],
    requiredCredentials: [],
    categories: ["system", "files"],
    trustLevel: "semi-trusted",
  },
  {
    id: "gmail",
    name: "Gmail",
    description:
      "Read, search, and manage your Gmail inbox and send emails",
    icon: "📧",
    npmPackage: "mcp-mail-server",
    command: "npx",
    args: ["-y", "mcp-mail-server"],
    requiredCredentials: [
      {
        key: "EMAIL_USER",
        label: "Email Address",
        helpText: "Your full Gmail address (e.g. you@gmail.com).",
        sensitive: false,
      },
      {
        key: "EMAIL_PASS",
        label: "App Password",
        helpText:
          "Go to your Google Account → Security → 2-Step Verification → App passwords. Create a new app password for 'Mail'. Copy the 16-character code (spaces are fine).",
        helpUrl: "https://myaccount.google.com/apppasswords",
        sensitive: true,
      },
    ],
    // Pre-filled env vars for Gmail's IMAP/SMTP servers
    defaultEnv: {
      IMAP_HOST: "imap.gmail.com",
      IMAP_PORT: "993",
      IMAP_SECURE: "true",
      SMTP_HOST: "smtp.gmail.com",
      SMTP_PORT: "465",
      SMTP_SECURE: "true",
    },
    categories: ["email", "communication", "google"],
    trustLevel: "semi-trusted",
  },
  {
    id: "gdrive",
    name: "Google Drive",
    description: "Search and access files in your Google Drive",
    icon: "💾",
    npmPackage: "@modelcontextprotocol/server-gdrive",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-gdrive"],
    requiredCredentials: [],
    categories: ["productivity", "files", "google"],
    trustLevel: "semi-trusted",
  },
  {
    id: "slack",
    name: "Slack",
    description:
      "Read messages, post updates, and manage channels in Slack",
    icon: "💬",
    npmPackage: "@modelcontextprotocol/server-slack",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-slack"],
    requiredCredentials: [
      {
        key: "SLACK_BOT_TOKEN",
        label: "Slack Bot Token",
        helpText:
          "Create a Slack app at api.slack.com/apps, add Bot Token Scopes (channels:read, chat:write, etc.), then install to your workspace. Copy the Bot User OAuth Token (starts with xoxb-).",
        helpUrl: "https://api.slack.com/apps",
        sensitive: true,
      },
      {
        key: "SLACK_TEAM_ID",
        label: "Slack Team/Workspace ID",
        helpText:
          "Found in Slack → Settings & administration → Workspace settings, or in the URL when using Slack in a browser.",
        sensitive: false,
      },
    ],
    categories: ["communication", "messaging"],
    trustLevel: "semi-trusted",
  },
  {
    id: "brave-search",
    name: "Brave Search",
    description: "Search the web privately using Brave Search API",
    icon: "🔍",
    npmPackage: "@modelcontextprotocol/server-brave-search",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-brave-search"],
    requiredCredentials: [
      {
        key: "BRAVE_API_KEY",
        label: "Brave Search API Key",
        helpText:
          "Sign up for a free API key at brave.com/search/api. The free tier includes 2,000 queries/month.",
        helpUrl: "https://brave.com/search/api/",
        sensitive: true,
      },
    ],
    categories: ["search", "web"],
    trustLevel: "semi-trusted",
  },
  {
    id: "memory",
    name: "Memory",
    description: "Persistent memory storage using a knowledge graph",
    icon: "🧠",
    npmPackage: "@modelcontextprotocol/server-memory",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-memory"],
    requiredCredentials: [],
    categories: ["system", "memory"],
    trustLevel: "trusted",
  },
];

/**
 * Find a template by exact ID, name match, or category match.
 */
export function findTemplate(
  idOrName: string,
): MCPServerTemplate | undefined {
  const lower = idOrName.toLowerCase().trim();

  // Exact ID match
  const exact = MCP_SERVER_CATALOG.find((t) => t.id === lower);
  if (exact) return exact;

  // Name match (case-insensitive)
  const byName = MCP_SERVER_CATALOG.find(
    (t) => t.name.toLowerCase() === lower,
  );
  if (byName) return byName;

  // Common aliases
  const aliases: Record<string, string> = {
    gmail: "gmail",
    "google mail": "gmail",
    "google email": "gmail",
    email: "gmail",
    mail: "gmail",
    inbox: "gmail",
    drive: "gdrive",
    "google drive": "gdrive",
    git: "github",
    code: "github",
    repo: "github",
    repos: "github",
    repository: "github",
    search: "brave-search",
    "web search": "brave-search",
    brave: "brave-search",
    files: "filesystem",
    "file system": "filesystem",
    fs: "filesystem",
    chat: "slack",
    messaging: "slack",
  };

  const aliasId = aliases[lower];
  if (aliasId) return MCP_SERVER_CATALOG.find((t) => t.id === aliasId);

  // Partial match on name or description
  const partial = MCP_SERVER_CATALOG.find(
    (t) =>
      t.name.toLowerCase().includes(lower) ||
      t.description.toLowerCase().includes(lower),
  );
  if (partial) return partial;

  // Category match
  return MCP_SERVER_CATALOG.find((t) =>
    t.categories.some((c) => c.includes(lower)),
  );
}

/**
 * Search the catalog by query, returning all matches.
 */
export function searchCatalog(query: string): MCPServerTemplate[] {
  const lower = query.toLowerCase().trim();
  return MCP_SERVER_CATALOG.filter(
    (t) =>
      t.id.includes(lower) ||
      t.name.toLowerCase().includes(lower) ||
      t.description.toLowerCase().includes(lower) ||
      t.categories.some((c) => c.includes(lower)),
  );
}
