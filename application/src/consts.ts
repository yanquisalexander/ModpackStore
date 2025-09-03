export const API_ENDPOINT = (() => {
    // Detect dev mode and read VITE_API_ENDPOINT in a safe way across environments.
    // Strategy:
    // 1) Try to read Vite's import.meta.env inside a try/catch (works in renderer/bundled code).
    // 2) If that fails, fall back to globalThis (Node/Electron-like environments) to avoid TS errors.

    let isDev = false;
    let viteEndpoint: string | undefined;

    try {
        // import.meta may not be available in all runtimes; access safely and ignore TS checks.
        // @ts-ignore
        const meta = import.meta as any;
        isDev = !!meta?.env?.DEV || meta?.env?.MODE === "development" || false;
        viteEndpoint = meta?.env?.VITE_API_ENDPOINT;
    } catch (_err) {
        // import.meta not available (e.g., running in Node), fallback to globalThis
        // Use globalThis to avoid referencing `process` directly which may be missing in types
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const g = globalThis as any;
        const proc = g?.process;
        isDev = !!(proc?.env && (proc.env.NODE_ENV === "development" || proc.env.DEV === "true"));
        viteEndpoint = proc?.env?.VITE_API_ENDPOINT;
    }

    if (isDev) {
        return "https://api-modpackstore.alexitoo.dev/v1";
    }

    return (viteEndpoint && String(viteEndpoint)) || "https://api-modpackstore.saltouruguayserver.com/v1";
})();

export const MICROSOFT_CLIENT_ID = "b999888a-cd19-4e13-8ca4-f276a9ba2a68";