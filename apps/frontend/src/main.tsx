import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/global.css";
import "./styles/theme.css";
import "./styles/undo-toast.css";
import { initTheme } from "./hooks/useTheme";
import { registerPrimitiveBlocks, registerDomainComponents } from "./blocks/components";

// Apply saved theme before first paint to avoid flash
initTheme();

// Register all block components before first render
registerPrimitiveBlocks();
registerDomainComponents();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
