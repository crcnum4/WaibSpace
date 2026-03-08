import { createBrowserRouter } from "react-router-dom";
import Layout from "../components/Layout";
import HomePage from "../pages/HomePage";
import InboxPage from "../pages/InboxPage";
import CalendarPage from "../pages/CalendarPage";
import SettingsPage from "../pages/SettingsPage";
import ApprovalsPage from "../pages/ApprovalsPage";
import IntentResolutionPage from "../pages/IntentResolutionPage";

// Known routes
const knownRoutes = [
  { index: true, element: <HomePage /> },
  { path: "inbox", element: <InboxPage /> },
  { path: "calendar", element: <CalendarPage /> },
  { path: "settings", element: <SettingsPage /> },
  { path: "approvals", element: <ApprovalsPage /> },
];

// Catch-all: unknown paths become intent queries
const catchAllRoute = { path: "*", element: <IntentResolutionPage /> };

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [...knownRoutes, catchAllRoute],
  },
]);
