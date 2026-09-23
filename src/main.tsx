import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Dashboard } from "@/components/dashboard";
import "@/src/index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Dashboard />
  </StrictMode>,
);
