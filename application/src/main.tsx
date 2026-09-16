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
import { warn, debug, trace, info, error } from '@tauri-apps/plugin-log';
import { preloadSounds } from '@/utils/sounds';
import { useLayout } from './providers/LayoutProvider';
import { initApiEndpoint } from './consts';


// La llamada a Discord RPC se mantiene igual
startDiscordRpc("943184136976334879").catch((err) => {
  console.error("Failed to start Discord RPC:", err);
});

// Preload sounds including notification sounds
preloadSounds();

const $root = document.getElementById("root");

if (!$root) {
  throw new Error("Root element not found");
}

function forwardConsole(
  fnName: 'log' | 'debug' | 'info' | 'warn' | 'error',
  logger: (message: string) => Promise<void>
) {
  const original = console[fnName];
  console[fnName] = (...args: any[]) => {
    original(...args);
    const message = args.map(arg => {
      if (arg instanceof Error) return `${arg.name}: ${arg.message}\n${arg.stack || ''}`;
      if (typeof arg === 'object') {
        try { return JSON.stringify(arg); } catch { return String(arg); }
      }
      return String(arg);
    }).join(' ');
    logger(message).catch(() => {});
  };
}

forwardConsole('log', trace);
forwardConsole('debug', debug);
forwardConsole('info', info);
forwardConsole('warn', warn);
forwardConsole('error', error);

window.addEventListener('error', (event) => {
  const message = `[Unhandled Error] ${event.message} at ${event.filename}:${event.lineno}:${event.colno}`;
  error(message).catch(() => {});
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason instanceof Error
    ? `${event.reason.name}: ${event.reason.message}\n${event.reason.stack || ''}`
    : String(event.reason);
  error(`[Unhandled Rejection] ${reason}`).catch(() => {});
});


// Componente wrapper para usar el contexto
const LayoutWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { hasSidebar } = useLayout();
  return (
    <div id="mstore-layout" className={`mstore-layout-base ${!hasSidebar ? 'no-sidebar' : ''}`}>
      {children}
    </div>
  );
};

import { PayPalScriptProvider } from "@paypal/react-paypal-js";

// ... existing code ...

const initialOptions = {
  "clientId": import.meta.env.VITE_PAYPAL_CLIENT_ID || "test",
  currency: "USD",
  intent: "capture",
};

// Initialize API endpoint from system_overrides before rendering
async function bootstrap() {
  await initApiEndpoint();

  createRoot($root).render(
    <AppProviders>
      <PayPalScriptProvider options={initialOptions}>
        <BrowserRouter>
          <LayoutWrapper>
            <AppTitleBar />
            <App />
            <Toaster theme="dark" />
            <UpdateStatus />
          </LayoutWrapper>
        </BrowserRouter>
      </PayPalScriptProvider>
    </AppProviders>
  );
}

bootstrap();
