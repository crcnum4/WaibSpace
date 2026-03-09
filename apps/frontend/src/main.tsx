import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/global.css";
import "./styles/theme.css";
import "./styles/gmail-components.css";
import "./styles/undo-toast.css";
import { initTheme } from "./hooks/useTheme";

// Apply saved theme before first paint to avoid flash
initTheme();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
