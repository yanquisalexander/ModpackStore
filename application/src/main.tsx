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
import { info, debug, error, warn } from "@tauri-apps/plugin-log";

// La llamada a Discord RPC se mantiene igual
startDiscordRpc("943184136976334879").catch((err) => {
  console.error("Failed to start Discord RPC:", err);
});

const $root = document.getElementById("root");

if (!$root) {
  throw new Error("Root element not found");
}

/* 
  Monkey Patch Console Log

   .log => Use original, and redirect to info method
   .debug => Use original, and redirect to debug method
   .error => Use original, and redirect to error method
   .warn => Use original, and redirect to warn method
*/

// Función helper para patch un método de console
const patchConsoleMethod = (method: keyof Console, logger: (...args: any[]) => void) => {
  const original = (console as any)[method];
  (console as any)[method] = (...args: any[]) => {
    original(...args);
    // Convertir args a string para el logger de Tauri
    const message = args.map(arg => {
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');
    logger(message);
  };
};

patchConsoleMethod('error', error);
patchConsoleMethod('warn', warn);

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