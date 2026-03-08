import { Outlet } from "react-router-dom";

export default function Layout() {
  return (
    <div className="layout">
      <header className="layout-header">
        <span className="logo">WaibSpace</span>
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
