import { useState } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [globalInput, setGlobalInput] = useState("");

  const handleGlobalSubmit = () => {
    const text = globalInput.trim();
    if (!text) return;
    // Navigate to home page where the WebSocket chat lives,
    // passing the message via location state
    setGlobalInput("");
    if (location.pathname !== "/") {
      navigate("/", { state: { pendingMessage: text } });
    } else {
      // Dispatch a custom event that HomePage can listen for
      window.dispatchEvent(new CustomEvent("waibspace:global-message", { detail: text }));
    }
  };

  const handleGlobalKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleGlobalSubmit();
    }
  };

  return (
    <div className="layout">
      <header className="layout-header">
        <Link to="/" className="logo">WaibSpace</Link>
        <nav className="layout-nav">
          <Link
            to="/"
            className={`nav-link ${location.pathname === "/" ? "active" : ""}`}
          >
            Home
          </Link>
          <Link
            to="/tasks"
            className={`nav-link ${location.pathname === "/tasks" ? "active" : ""}`}
          >
            Tasks
          </Link>
          <Link
            to="/settings"
            className={`nav-link ${location.pathname === "/settings" ? "active" : ""}`}
          >
            Settings
          </Link>
        </nav>
      </header>

      <main className="layout-main">
        <Outlet />
      </main>

      {location.pathname !== "/" && (
        <footer className="layout-footer">
          <div className="global-input-bar">
            <input
              className="input-bar"
              type="text"
              value={globalInput}
              onChange={(e) => setGlobalInput(e.target.value)}
              onKeyDown={handleGlobalKeyDown}
              placeholder="Type a message..."
              aria-label="Message input"
            />
            <button
              className="global-send-btn"
              onClick={handleGlobalSubmit}
              disabled={!globalInput.trim()}
            >
              Send
            </button>
          </div>
        </footer>
      )}
    </div>
  );
}
