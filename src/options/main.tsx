/**
 * Entry point for the options (settings) page.
 * Finds the root DOM element and mounts the React App component.
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Settings root element not found");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
