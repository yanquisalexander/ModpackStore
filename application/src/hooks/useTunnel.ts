import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { cleanConsoleOutput } from "@/utils/terminal";

export interface TunnelLog {
    instanceId: string;
    line: string;
    source: "stdout" | "stderr";
}

export function useTunnel(instanceId: string, instancePath?: string) {
    const [status, setStatus] = useState<string | null>(null);
    const [logs, setLogs] = useState<string[]>([]);
    const [claimUrl, setClaimUrl] = useState<string | null>(null);
    const [publicAddress, setPublicAddress] = useState<string | null>(null);

    const refreshStatus = useCallback(async () => {
        try {
            const s = await invoke<string | null>("get_tunnel_status", { instanceId });
            setStatus(s);
        } catch (e) {
            console.error("Failed to get tunnel status", e);
        }
    }, [instanceId]);

    const install = async (provider: string) => {
        await invoke("install_tunnel_provider", { provider });
    };

    const start = async (provider: string = "playit") => {
        if (!instancePath) throw new Error("Instance path is required");
        setLogs([]); // Clear logs when starting new tunnel
        await invoke("start_tunnel", {
            instanceId,
            instancePath,
            provider
        });
        await refreshStatus();
    };

    const stop = async () => {
        await invoke("stop_tunnel", { instanceId });
        setStatus(null);
        setClaimUrl(null);
        setPublicAddress(null);
        setLogs([]);
    };

    const clearLogs = useCallback(() => {
        setLogs([]);
    }, []);

    useEffect(() => {
        refreshStatus();

        const unlisten = listen<TunnelLog>("tunnel-log", (event) => {
            if (event.payload.instanceId === instanceId) {
                const line = cleanConsoleOutput(event.payload.line);
                if (!line.trim()) return;

                setLogs(prev => [...prev.slice(-100), line]);

                // Detect Claim URL for playit
                const match = line.match(/https:\/\/playit\.gg\/claim\/[a-zA-Z0-9-]+/);
                if (match) {
                    setClaimUrl(match[0]);
                }

                // Try to detect allocated address (heuristic, playit logs vary)
                // "New tunnel ... => ... .playit.gg:..."
                if (line.includes(".playit.gg") || line.includes(".gl.joinmc.link")) {
                    // Simple extraction not perfect but helpful
                    // Look for hostname
                }
            }
        });

        return () => {
            unlisten.then(f => f());
        };
    }, [instanceId]);

    return {
        status,
        logs,
        claimUrl,
        publicAddress,
        install,
        start,
        stop,
        clearLogs,
        refreshStatus
    };
}
