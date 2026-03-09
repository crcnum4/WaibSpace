import { useState, useEffect, useCallback } from "react";

interface CatalogEntry {
  id: string;
  name: string;
  description: string;
  icon: string;
  categories: string[];
  credentialCount: number;
}

interface CredentialSpec {
  key: string;
  label: string;
  helpText: string;
  helpUrl?: string;
  sensitive: boolean;
}

interface CatalogDetail {
  id: string;
  name: string;
  description: string;
  icon: string;
  categories: string[];
  requiredCredentials: CredentialSpec[];
}

const ALL_CATEGORIES = [
  "all",
  "communication",
  "development",
  "productivity",
  "search",
  "system",
];

export function MCPMarketplace() {
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Setup flow state
  const [setupTarget, setSetupTarget] = useState<CatalogDetail | null>(null);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [setupSuccess, setSetupSuccess] = useState<{
    name: string;
    toolCount: number;
  } | null>(null);

  // Track which servers are already installed
  const [installedIds, setInstalledIds] = useState<Set<string>>(new Set());

  const fetchCatalog = useCallback(async () => {
    try {
      const res = await fetch("/api/mcp/catalog");
      if (res.ok) {
        const data: CatalogEntry[] = await res.json();
        setCatalog(data);
      } else {
        setError("Failed to load marketplace catalog");
      }
    } catch {
      setError("Could not connect to backend");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchInstalled = useCallback(async () => {
    try {
      const res = await fetch("/api/mcp/servers");
      if (res.ok) {
        const servers: Array<{ config: { id: string } }> = await res.json();
        setInstalledIds(
          new Set(
            servers
              .map((s) => s.config.id)
              .filter((id) => id.startsWith("catalog-"))
              .map((id) => id.replace("catalog-", "")),
          ),
        );
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchCatalog();
    fetchInstalled();
  }, [fetchCatalog, fetchInstalled]);

  const openSetup = async (entry: CatalogEntry) => {
    // If no credentials needed, install directly
    if (entry.credentialCount === 0) {
      await installServer(entry.id, {});
      return;
    }

    // Fetch full template details for credential specs
    // We use the catalog endpoint — the full detail comes from /api/mcp/catalog/:id
    // But since that endpoint doesn't exist, we fetch the full catalog and find the template
    // Actually, let's just show a credential form based on what we know
    setSetupError(null);
    setSetupSuccess(null);
    setCredentials({});

    // Fetch full template details from a detail endpoint or use a trick
    try {
      const res = await fetch(`/api/mcp/catalog/${entry.id}`);
      if (res.ok) {
        const detail: CatalogDetail = await res.json();
        setSetupTarget(detail);
      } else {
        // Fallback: just set a minimal target
        setSetupTarget({
          id: entry.id,
          name: entry.name,
          description: entry.description,
          icon: entry.icon,
          categories: entry.categories,
          requiredCredentials: [],
        });
      }
    } catch {
      // Fallback
      setSetupTarget({
        id: entry.id,
        name: entry.name,
        description: entry.description,
        icon: entry.icon,
        categories: entry.categories,
        requiredCredentials: [],
      });
    }
  };

  const installServer = async (
    templateId: string,
    creds: Record<string, string>,
  ) => {
    setSetupLoading(true);
    setSetupError(null);
    try {
      const res = await fetch("/api/mcp/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, credentials: creds }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSetupError(data.error ?? "Setup failed");
        return;
      }
      setSetupSuccess({
        name: data.name,
        toolCount: data.tools?.length ?? 0,
      });
      setInstalledIds((prev) => new Set([...prev, templateId]));
      // Close the setup dialog after a short delay
      setTimeout(() => {
        setSetupTarget(null);
        setSetupSuccess(null);
      }, 2000);
    } catch {
      setSetupError("Network error — could not reach backend");
    } finally {
      setSetupLoading(false);
    }
  };

  const handleSetupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!setupTarget) return;
    installServer(setupTarget.id, credentials);
  };

  const filteredCatalog = catalog.filter((entry) => {
    const matchesCategory =
      selectedCategory === "all" ||
      entry.categories.some((c) => c === selectedCategory);
    const matchesSearch =
      !searchQuery ||
      entry.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  if (loading) {
    return (
      <div className="marketplace__loading">
        <span className="marketplace__loading-dot" />
        Loading marketplace...
      </div>
    );
  }

  if (error) {
    return (
      <div className="marketplace__error">
        <span className="marketplace__error-icon">!</span>
        {error}
      </div>
    );
  }

  return (
    <div className="marketplace">
      <div className="marketplace__header">
        <div className="marketplace__header-text">
          <h3 className="marketplace__title">MCP Marketplace</h3>
          <p className="marketplace__subtitle">
            Browse and install MCP tool servers with one click
          </p>
        </div>
      </div>

      <div className="marketplace__controls">
        <input
          className="marketplace__search"
          type="text"
          placeholder="Search tools..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <div className="marketplace__categories">
          {ALL_CATEGORIES.map((cat) => (
            <button
              key={cat}
              className={`marketplace__category-btn ${selectedCategory === cat ? "marketplace__category-btn--active" : ""}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="marketplace__grid">
        {filteredCatalog.length === 0 && (
          <div className="marketplace__empty">
            No tools match your search.
          </div>
        )}
        {filteredCatalog.map((entry) => {
          const isInstalled = installedIds.has(entry.id);
          return (
            <div key={entry.id} className="marketplace__card">
              <div className="marketplace__card-header">
                <span className="marketplace__card-icon">{entry.icon}</span>
                <div className="marketplace__card-info">
                  <span className="marketplace__card-name">{entry.name}</span>
                  <div className="marketplace__card-tags">
                    {entry.categories.map((cat) => (
                      <span key={cat} className="marketplace__tag">
                        {cat}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <p className="marketplace__card-desc">{entry.description}</p>
              <div className="marketplace__card-footer">
                {entry.credentialCount > 0 && (
                  <span className="marketplace__card-cred-hint">
                    {entry.credentialCount} credential
                    {entry.credentialCount !== 1 ? "s" : ""} required
                  </span>
                )}
                {isInstalled ? (
                  <span className="marketplace__card-installed">
                    Installed
                  </span>
                ) : (
                  <button
                    className="marketplace__card-add-btn"
                    onClick={() => openSetup(entry)}
                  >
                    {entry.credentialCount > 0 ? "Set Up" : "Add"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Setup dialog (credential input) */}
      {setupTarget && (
        <div className="marketplace__overlay" onClick={() => !setupLoading && setSetupTarget(null)}>
          <div
            className="marketplace__dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="marketplace__dialog-header">
              <span className="marketplace__dialog-icon">
                {setupTarget.icon}
              </span>
              <h4 className="marketplace__dialog-title">
                Set up {setupTarget.name}
              </h4>
            </div>

            {setupSuccess ? (
              <div className="marketplace__dialog-success">
                <span className="marketplace__dialog-success-icon">
                  &#10003;
                </span>
                <p>
                  {setupSuccess.name} connected with {setupSuccess.toolCount}{" "}
                  tool{setupSuccess.toolCount !== 1 ? "s" : ""} available.
                </p>
              </div>
            ) : (
              <form
                className="marketplace__dialog-form"
                onSubmit={handleSetupSubmit}
              >
                {setupTarget.requiredCredentials.length === 0 ? (
                  <p className="marketplace__dialog-note">
                    No credentials required. Click Install to continue.
                  </p>
                ) : (
                  setupTarget.requiredCredentials.map((cred) => (
                    <div key={cred.key} className="marketplace__dialog-field">
                      <label
                        className="marketplace__dialog-label"
                        htmlFor={`cred-${cred.key}`}
                      >
                        {cred.label}
                      </label>
                      <input
                        id={`cred-${cred.key}`}
                        className="marketplace__dialog-input"
                        type={cred.sensitive ? "password" : "text"}
                        value={credentials[cred.key] ?? ""}
                        onChange={(e) =>
                          setCredentials((prev) => ({
                            ...prev,
                            [cred.key]: e.target.value,
                          }))
                        }
                        placeholder={cred.helpText.slice(0, 60) + "..."}
                        required
                      />
                      <span className="marketplace__dialog-help">
                        {cred.helpText}
                        {cred.helpUrl && (
                          <>
                            {" "}
                            <a
                              href={cred.helpUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="marketplace__dialog-help-link"
                            >
                              Get one here
                            </a>
                          </>
                        )}
                      </span>
                    </div>
                  ))
                )}

                {setupError && (
                  <div className="marketplace__dialog-error">{setupError}</div>
                )}

                <div className="marketplace__dialog-actions">
                  <button
                    type="button"
                    className="marketplace__dialog-cancel-btn"
                    onClick={() => setSetupTarget(null)}
                    disabled={setupLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="marketplace__dialog-install-btn"
                    disabled={setupLoading}
                  >
                    {setupLoading ? "Installing..." : "Install"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
