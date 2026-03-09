import { useState } from "react";
import { ConnectionManager } from "../components/ConnectionManager";
import { ConnectorHealthDashboard } from "../components/ConnectorHealthDashboard";
import { useTheme, type Theme } from "../hooks/useTheme";

type SettingsSection = "connections" | "health" | "preferences" | "about";

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SettingsSection>("connections");
  const { theme, setTheme } = useTheme();
  const [notifyErrors, setNotifyErrors] = useState(true);
  const [notifyTaskComplete, setNotifyTaskComplete] = useState(true);

  const sections: { id: SettingsSection; label: string }[] = [
    { id: "connections", label: "Connections" },
    { id: "health", label: "Health" },
    { id: "preferences", label: "Preferences" },
    { id: "about", label: "About" },
  ];

  return (
    <div className="page settings-page">
      <h1>Settings</h1>

      <nav className="settings-nav">
        {sections.map((section) => (
          <button
            key={section.id}
            className={`settings-nav__tab ${activeSection === section.id ? "settings-nav__tab--active" : ""}`}
            onClick={() => setActiveSection(section.id)}
          >
            {section.label}
          </button>
        ))}
      </nav>

      <div className="settings-content">
        {activeSection === "connections" && (
          <section className="settings-section">
            <ConnectionManager />
          </section>
        )}

        {activeSection === "health" && (
          <section className="settings-section">
            <ConnectorHealthDashboard />
          </section>
        )}

        {activeSection === "preferences" && (
          <section className="settings-section">
            <h3 className="settings-section__title">Appearance</h3>
            <div className="settings-card">
              <div className="settings-row">
                <div className="settings-row__info">
                  <span className="settings-row__label">Theme</span>
                  <span className="settings-row__description">
                    Choose dark, light, or auto (follows system preference)
                  </span>
                </div>
                <div className="settings-toggle-group">
                  {(["dark", "light", "auto"] as Theme[]).map((opt) => (
                    <button
                      key={opt}
                      className={`settings-toggle-group__btn ${theme === opt ? "settings-toggle-group__btn--active" : ""}`}
                      onClick={() => setTheme(opt)}
                    >
                      {opt.charAt(0).toUpperCase() + opt.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <h3 className="settings-section__title">Notifications</h3>
            <div className="settings-card">
              <div className="settings-row">
                <div className="settings-row__info">
                  <span className="settings-row__label">Error alerts</span>
                  <span className="settings-row__description">
                    Show notifications when a task or connection fails
                  </span>
                </div>
                <label className="settings-switch">
                  <input
                    type="checkbox"
                    checked={notifyErrors}
                    onChange={() => setNotifyErrors(!notifyErrors)}
                  />
                  <span className="settings-switch__slider" />
                </label>
              </div>

              <div className="settings-row">
                <div className="settings-row__info">
                  <span className="settings-row__label">Task completion</span>
                  <span className="settings-row__description">
                    Notify when background tasks finish executing
                  </span>
                </div>
                <label className="settings-switch">
                  <input
                    type="checkbox"
                    checked={notifyTaskComplete}
                    onChange={() => setNotifyTaskComplete(!notifyTaskComplete)}
                  />
                  <span className="settings-switch__slider" />
                </label>
              </div>
            </div>
          </section>
        )}

        {activeSection === "about" && (
          <section className="settings-section">
            <div className="settings-card">
              <div className="settings-about">
                <h3 className="settings-about__name">WaibSpace</h3>
                <span className="settings-about__version">v0.0.1</span>
              </div>
              <p className="settings-about__tagline">
                AI-native personal assistant powered by MCP
              </p>
            </div>

            <div className="settings-card">
              <h3 className="settings-section__title settings-section__title--incard">
                Resources
              </h3>
              <ul className="settings-links">
                <li className="settings-links__item">
                  <a
                    href="https://github.com/crcnum4/WaibSpace"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="settings-links__anchor"
                  >
                    GitHub Repository
                  </a>
                </li>
                <li className="settings-links__item">
                  <a
                    href="https://modelcontextprotocol.io"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="settings-links__anchor"
                  >
                    MCP Documentation
                  </a>
                </li>
              </ul>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
