// main.jsx
import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AppTitleBar } from "./components/AppTitleBar";
import { Toaster } from "sonner";
import { UpdateStatus } from "./components/UpdateStatus";
import { start as startDiscordRpc } from "tauri-plugin-drpc";
import { AppProviders } from "./providers/AppProviders"; // Importas el nuevo componente

// La llamada a Discord RPC se mantiene igual
startDiscordRpc("943184136976334879").catch((err) => {
  console.error("Failed to start Discord RPC:", err);
});

const $root = document.getElementById("root");

if (!$root) {
  throw new Error("Root element not found");
}

createRoot($root).render(
  <BrowserRouter>
    <AppProviders>
      <AppTitleBar />
      <App />
      <Toaster theme="dark" />
      <UpdateStatus />
    </AppProviders>
  </BrowserRouter>
);