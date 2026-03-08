import { useState } from "react";
import type { SurfaceProps } from "./registry";

interface ConnectionGuideData {
  step: "browse" | "credentials" | "connecting" | "success" | "error";
  message: string;
  availableServices: Array<{
    id: string;
    name: string;
    description: string;
    icon: string;
    categories: string[];
  }>;
  selectedService?: {
    id: string;
    name: string;
    icon: string;
    description: string;
  };
  credentialFields?: Array<{
    key: string;
    label: string;
    helpText: string;
    helpUrl?: string;
    sensitive: boolean;
  }>;
  discoveredTools?: Array<{ name: string; description?: string }>;
  errorDetail?: string;
}

export function ConnectionGuideSurface({
  spec,
  onInteraction,
}: SurfaceProps) {
  const data = spec.data as ConnectionGuideData;

  // Local state for the connect flow (credentials → connecting → success/error)
  const [localStep, setLocalStep] = useState<
    "idle" | "connecting" | "success" | "error"
  >("idle");
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [discoveredTools, setDiscoveredTools] = useState<
    Array<{ name: string; description?: string }>
  >([]);
  const [errorMessage, setErrorMessage] = useState("");

  // The active step: use localStep override if we're in the connect flow, otherwise use data.step
  const activeStep = localStep !== "idle" ? localStep : data.step;

  const handleSelectService = (serviceId: string) => {
    onInteraction("select-service", serviceId, { service: serviceId });
  };

  const handleCredentialChange = (key: string, value: string) => {
    setCredentials((prev) => ({ ...prev, [key]: value }));
  };

  const handleConnect = async () => {
    if (!data.selectedService) return;

    setLocalStep("connecting");

    const backendPort = import.meta.env.VITE_WS_PORT || 3001;
    const backendHost = window.location.hostname;

    try {
      const res = await fetch(
        `http://${backendHost}:${backendPort}/api/mcp/setup`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            templateId: data.selectedService.id,
            credentials,
          }),
        },
      );

      const result = (await res.json()) as {
        ok?: boolean;
        tools?: Array<{ name: string; description?: string }>;
        error?: string;
      };

      if (result.ok && result.tools) {
        setDiscoveredTools(result.tools);
        setLocalStep("success");
      } else {
        setErrorMessage(result.error || "Connection failed");
        setLocalStep("error");
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Network error");
      setLocalStep("error");
    }
  };

  const handleRetry = () => {
    setLocalStep("idle");
    setErrorMessage("");
  };

  return (
    <div className="surface connection-guide-surface">
      <div className="surface-header">
        <h3>{spec.title}</h3>
      </div>

      <div className="connection-guide-content">
        {activeStep !== "connecting" &&
          activeStep !== "success" &&
          activeStep !== "error" && (
            <p className="connection-guide-message">{data.message}</p>
          )}

        {/* Browse step: show service catalog */}
        {activeStep === "browse" && (
          <div className="connection-service-list">
            {data.availableServices.map((service) => (
              <button
                key={service.id}
                className="connection-service-card"
                onClick={() => handleSelectService(service.id)}
              >
                <span className="connection-service-icon">{service.icon}</span>
                <div className="connection-service-info">
                  <span className="connection-service-name">
                    {service.name}
                  </span>
                  <span className="connection-service-desc">
                    {service.description}
                  </span>
                </div>
                <span className="connection-service-arrow">&rarr;</span>
              </button>
            ))}
          </div>
        )}

        {/* Credentials step: show input fields */}
        {activeStep === "credentials" && data.selectedService && (
          <div className="connection-credentials-section">
            <div className="connection-selected-service">
              <span className="connection-service-icon">
                {data.selectedService.icon}
              </span>
              <div className="connection-service-info">
                <span className="connection-service-name">
                  {data.selectedService.name}
                </span>
                <span className="connection-service-desc">
                  {data.selectedService.description}
                </span>
              </div>
            </div>

            {data.credentialFields && data.credentialFields.length > 0 ? (
              <div className="connection-credential-fields">
                {data.credentialFields.map((field) => (
                  <div key={field.key} className="connection-credential-field">
                    <label className="connection-credential-label">
                      {field.label}
                    </label>
                    <input
                      type={field.sensitive ? "password" : "text"}
                      className="connection-credential-input"
                      placeholder={field.label}
                      value={credentials[field.key] || ""}
                      onChange={(e) =>
                        handleCredentialChange(field.key, e.target.value)
                      }
                    />
                    <p className="connection-credential-help">
                      {field.helpText}
                      {field.helpUrl && (
                        <>
                          {" "}
                          <a
                            href={field.helpUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="connection-help-link"
                          >
                            Get it here &rarr;
                          </a>
                        </>
                      )}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="connection-no-creds-message">
                No credentials needed — just click Connect!
              </p>
            )}

            <button className="connection-connect-btn" onClick={handleConnect}>
              Connect {data.selectedService.name}
            </button>
          </div>
        )}

        {/* Connecting step: loading */}
        {activeStep === "connecting" && (
          <div className="connection-loading-section">
            <div className="connection-spinner" />
            <p className="connection-loading-message">
              Setting up {data.selectedService?.name || "connection"}...
            </p>
          </div>
        )}

        {/* Success step */}
        {activeStep === "success" && (
          <div className="connection-success-section">
            <div className="connection-success-icon">&check;</div>
            <p className="connection-success-message">
              {data.selectedService?.name || "Service"} connected successfully!
            </p>
            {discoveredTools.length > 0 && (
              <div className="connection-tools-list">
                <p className="connection-tools-label">Available tools:</p>
                {discoveredTools.map((tool, i) => (
                  <div key={i} className="connection-tool-item">
                    <span className="connection-tool-name">{tool.name}</span>
                    {tool.description && (
                      <span className="connection-tool-desc">
                        {tool.description}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Error step */}
        {activeStep === "error" && (
          <div className="connection-error-section">
            <p className="connection-error-message">
              {errorMessage ||
                data.errorDetail ||
                "Something went wrong. Please try again."}
            </p>
            <button className="connection-retry-btn" onClick={handleRetry}>
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
