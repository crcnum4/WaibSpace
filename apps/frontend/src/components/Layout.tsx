import { Outlet, Link, useLocation } from "react-router-dom";

export default function Layout() {
  const location = useLocation();

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

      <footer className="layout-footer">
        <input
          className="input-bar"
          type="text"
          placeholder="Type a message…"
          aria-label="Message input"
        />
      </footer>
    </div>
  );
}
