import React from "react";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="layout">
      <header className="layout-header">
        <span className="logo">WaibSpace</span>
      </header>

      <main className="layout-main">{children}</main>

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
