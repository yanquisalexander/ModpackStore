import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    LucideServer,
    LucideTerminal,
    LucideFolder,
    LucideSettings,
    LucidePlay,
    LucideSquare,
    LucideRefreshCcw,
    LucideCpu,
    LucideDatabase,
    LucideSend,
    LucideGlobe,
    LucideActivity,
    LucideUsers,
    LucideTrash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { toast } from 'sonner';
import { useGlobalContext } from '@/stores/GlobalContext';
import { useInstances } from '@/stores/InstancesContext';
import { useTunnel } from '@/hooks/useTunnel';
import type { MinecraftInstance } from '@/types/TauriCommandReturns';
import { EulaDialog } from '@/components/instance/EulaDialog';
import { cn } from "@/lib/utils";
import { cleanConsoleOutput } from "@/utils/terminal";

export const ServerDetailView: React.FC = () => {
    const { instanceId } = useParams<{ instanceId: string }>();
    const navigate = useNavigate();
    const { setTitleBarState } = useGlobalContext();
    const { instances: runningInstances } = useInstances();

    const [instance, setInstance] = useState<MinecraftInstance | null>(null);
    const [loading, setLoading] = useState(true);
    const [logs, setLogs] = useState<{ message: string, type: 'stdout' | 'stderr' }[]>([]);
    const [command, setCommand] = useState('');
    const [showEulaDialog, setShowEulaDialog] = useState(false);
    const [stats, setStats] = useState<{ cpu_usage: number, memory_usage: number, player_count: number } | null>(null);
    const [ramAllocation, setRamAllocation] = useState<number>(4096);
    const [serverProps, setServerProps] = useState<Record<string, string>>({});
    const scrollRef = useRef<HTMLDivElement>(null);

    const tunnel = useTunnel(instanceId!, instance?.instanceDirectory);
    const isRunning = runningInstances.some(i => i.id === instanceId && i.status === 'running');

    // Polling stats
    useEffect(() => {
        let interval: any;
        if (isRunning) {
            const fetchStats = async () => {
                try {
                    const data = await invoke<any>('get_instance_stats', { instanceId });
                    setStats(data);
                } catch (error) {
                    console.error("Error fetching stats:", error);
                }
            };
            fetchStats();
            interval = setInterval(fetchStats, 3000);
        } else {
            setStats(null);
        }
        return () => clearInterval(interval);
    }, [isRunning, instanceId]);

    // Fetch initial config and server properties
    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const ram = await invoke<number>('get_config_value', { key: 'ramAllocation' });
                if (ram) setRamAllocation(ram);

                const props = await invoke<Record<string, string>>('get_server_properties', { instanceId });
                setServerProps(props);
            } catch (error) {
                console.error("Error fetching initial data:", error);
            }
        };
        fetchInitialData();
    }, [instanceId]);

    // Clear tunnel logs when server stops
    useEffect(() => {
        if (!isRunning) {
            tunnel.clearLogs();
        }
    }, [isRunning, tunnel.clearLogs]);

    const fetchInstance = useCallback(async () => {
        try {
            const data = await invoke<MinecraftInstance>('get_instance_by_id', { instanceId: instanceId! });
            setInstance(data);
        } catch (error) {
            toast.error("Error al obtener detalles del servidor");
            navigate('/servers');
        } finally {
            setLoading(false);
        }
    }, [instanceId, navigate]);

    useEffect(() => {
        fetchInstance();
    }, [fetchInstance]);

    useEffect(() => {
        if (!instance) return;
        setTitleBarState({
            title: `Servidor: ${instance.instanceName}`,
            icon: LucideServer,
            canGoBack: true,
            customIconClassName: "bg-purple-500/20 text-purple-400",
            opaque: false,
        });
    }, [instance, setTitleBarState]);

    useEffect(() => {
        const unlisten = listen('instance-console-log', (event: any) => {
            const { id, message, type } = event.payload;
            if (id === instanceId) {
                const cleanMessage = cleanConsoleOutput(message);
                if (cleanMessage.trim()) {
                    setLogs(prev => [...prev.slice(-999), { message: cleanMessage, type }]); // Mantener últimas 1000 líneas
                }
            }
        });
        return () => { unlisten.then(fn => fn()); };
    }, [instanceId]);

    // Auto-scroll al final cuando llegan logs
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs]);

    const handleStart = async (eulaAccepted: boolean = false) => {
        if (!instance) return;
        if (instance.instanceType === 'server' && !eulaAccepted) {
            try {
                const isAccepted = await invoke<boolean>('check_instance_eula', { instanceId: instance.instanceId });
                if (!isAccepted) {
                    setShowEulaDialog(true);
                    return;
                }
            } catch (error) { console.error("Error checking EULA:", error); }
        }
        try {
            await invoke('launch_mc_instance', { instanceId: instance.instanceId });
            toast.success("Iniciando servidor...");
        } catch (error) {
            if (error === "EULA_NOT_ACCEPTED") setShowEulaDialog(true);
            else toast.error("Error al iniciar: " + error);
        }
    };

    const handleAcceptEula = async () => {
        if (!instance) return;
        try {
            await invoke('accept_instance_eula', { instanceId: instance.instanceId });
            setShowEulaDialog(false);
            handleStart(true);
        } catch (error) { toast.error("Error al aceptar EULA"); }
    };

    const handleStop = async () => {
        try {
            await invoke('kill_mc_instance', { instanceId });
            toast.success("Señal de parada enviada");
        } catch (error) { toast.error("Error al detener"); }
    };
    const handleRestart = async () => {
        try {
            await invoke('restart_instance', { instanceId });
            toast.success("Reiniciando servidor...");
        } catch (error) {
            toast.error("Error al reiniciar: " + error);
        }
    };

    const handlePropertyChange = async (key: string, value: string) => {
        const newProps = { ...serverProps, [key]: value };
        setServerProps(newProps);
        try {
            await invoke('update_server_properties', { instanceId, properties: newProps });
            toast.success(`Propiedad ${key} actualizada`);
        } catch (error) {
            toast.error("Error al actualizar propiedad");
        }
    };
    const handleSendCommand = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!command.trim() || !isRunning) return;
        try {
            // Optimistic update para feedback instantáneo
            setLogs(prev => [...prev, { message: `> ${command}`, type: 'stdout' }]);
            await invoke('send_server_command', { instanceId, command: command.trim() });
            setCommand('');
        } catch (error) { toast.error("Error al enviar comando"); }
    };

    if (loading) return <div className="flex h-full items-center justify-center text-zinc-500">Cargando servidor...</div>;
    if (!instance) return null;

    return (
        <div className="flex flex-col h-[calc(100vh-32px)] bg-[#0a0a0a] text-white overflow-hidden">
            {/* --- HEADER --- */}
            <div className="px-6 py-4 border-b border-white/5 bg-[#0a0a0a]/80 backdrop-blur-md z-10 flex-shrink-0">
                <div className="flex items-center justify-between max-w-7xl mx-auto w-full">
                    <div className="flex items-center gap-4">
                        <div className={cn(
                            "p-3 rounded-2xl border transition-all duration-500",
                            isRunning
                                ? "bg-emerald-500/10 border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                                : "bg-purple-500/10 border-purple-500/20"
                        )}>
                            <LucideServer className={cn("w-6 h-6", isRunning ? "text-emerald-400" : "text-purple-400")} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white tracking-tight">{instance.instanceName}</h2>
                            <div className="flex items-center gap-2 mt-0.5">
                                <div className="flex items-center gap-1.5">
                                    <span className="relative flex h-2 w-2">
                                        {isRunning && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                                        <span className={cn("relative inline-flex rounded-full h-2 w-2", isRunning ? "bg-emerald-500" : "bg-zinc-600")}></span>
                                    </span>
                                    <span className={cn("text-xs font-medium", isRunning ? "text-emerald-400" : "text-zinc-500")}>
                                        {isRunning ? "En línea" : "Detenido"}
                                    </span>
                                </div>
                                <span className="text-zinc-700">|</span>
                                <span className="text-xs text-zinc-400">{instance.minecraftVersion}</span>
                                {instance.loaderType && (
                                    <>
                                        <span className="text-zinc-700">|</span>
                                        <span className="text-xs text-zinc-400 capitalize">{instance.loaderType}</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {!isRunning ? (
                            <Button onClick={() => handleStart()} className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-lg shadow-emerald-900/20 transition-all">
                                <LucidePlay className="w-4 h-4 mr-2 fill-current" /> Iniciar Servidor
                            </Button>
                        ) : (
                            <>
                                <Button size="sm" onClick={handleRestart} variant="outline" className="border-orange-500/20 text-orange-400 hover:bg-orange-500/10 hover:text-orange-300">
                                    <LucideRefreshCcw className="w-4 h-4 mr-2" /> Reiniciar
                                </Button>
                                <Button size="sm" onClick={handleStop} variant="destructive" className="bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20">
                                    <LucideSquare className="w-4 h-4 mr-2 fill-current" /> Detener
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* --- MAIN CONTENT --- */}
            <div className="flex-1 overflow-hidden p-6 max-w-7xl mx-auto w-full">
                <Tabs defaultValue="console" className="h-full flex flex-col gap-4">
                    <TabsList className="bg-zinc-900/50 border border-white/5 w-fit p-1 gap-1">
                        <TabsTrigger value="console" className="gap-2 data-[state=active]:bg-zinc-800"><LucideTerminal className="w-4 h-4" /> Consola</TabsTrigger>
                        <TabsTrigger value="dashboard" className="gap-2 data-[state=active]:bg-zinc-800"><LucideActivity className="w-4 h-4" /> Métricas</TabsTrigger>
                        <TabsTrigger value="files" className="gap-2 data-[state=active]:bg-zinc-800"><LucideFolder className="w-4 h-4" /> Archivos</TabsTrigger>
                        <TabsTrigger value="network" className="gap-2 data-[state=active]:bg-zinc-800"><LucideGlobe className="w-4 h-4" /> Red & Playit.gg</TabsTrigger>
                        <TabsTrigger value="settings" className="gap-2 data-[state=active]:bg-zinc-800"><LucideSettings className="w-4 h-4" /> Ajustes</TabsTrigger>
                    </TabsList>

                    {/* --- CONSOLE TAB (Fixed Height Fix) --- */}
                    <TabsContent value="console" className="flex-1 min-h-0 flex flex-col mt-0 data-[state=active]:flex">
                        <div className="flex-1 bg-[#0c0c0c] border border-white/10 rounded-xl overflow-hidden flex flex-col shadow-2xl relative">
                            {/* Prominent Claim URL Banner for Playit */}
                            {tunnel.claimUrl && (
                                <div className="bg-indigo-600/90 backdrop-blur-md p-3 flex items-center justify-between gap-4 animate-in slide-in-from-top duration-500 border-b border-white/5">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-white/20 p-2 rounded-lg">
                                            <LucideGlobe className="w-4 h-4 text-white" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-white">Configuración del Túnel Requerida</p>
                                            <p className="text-[10px] text-indigo-100 opacity-80">Haz clic para vincular tu servidor con Playit.gg</p>
                                        </div>
                                    </div>
                                    <a
                                        href={tunnel.claimUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="bg-white text-indigo-600 px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-50 transition-colors shadow-lg"
                                    >
                                        Vincular Ahora &rarr;
                                    </a>
                                </div>
                            )}

                            {/* Console Toolbar */}
                            <div className="h-10 px-4 border-b border-white/5 bg-white/[0.02] flex items-center justify-between flex-shrink-0">
                                <div className="flex items-center gap-2">
                                    <LucideTerminal className="w-4 h-4 text-zinc-600" />
                                    <span className="text-xs font-mono text-zinc-500">server@{instanceId}:~$</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-white/5" onClick={() => setLogs([])} title="Limpiar consola">
                                        <LucideTrash2 className="w-3.5 h-3.5 text-zinc-500" />
                                    </Button>
                                </div>
                            </div>

                            {/* Logs Area - Critical: min-h-0 and flex-1 */}
                            <div
                                ref={scrollRef}
                                className="flex-1 overflow-y-auto p-4 font-mono text-sm leading-relaxed custom-scrollbar scroll-smooth"
                            >
                                {logs.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-zinc-700 opacity-50 select-none">
                                        <LucideTerminal className="w-12 h-12 mb-2" />
                                        <p>La consola está vacía. Inicia el servidor para ver la salida.</p>
                                    </div>
                                ) : (
                                    logs.map((log, i) => {
                                        const urlRegex = /(https?:\/\/[^\s]+)/g;
                                        const cleanMessage = log.message;
                                        const parts = cleanMessage.split(urlRegex);

                                        return (
                                            <div key={i} className="break-words mb-0.5">
                                                <span className={cn(
                                                    "opacity-90",
                                                    log.type === 'stderr' ? 'text-red-400' : 'text-zinc-300'
                                                )}>
                                                    {parts.map((part, index) =>
                                                        urlRegex.test(part) ? (
                                                            <a
                                                                key={index}
                                                                href={part}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="text-purple-400 hover:underline"
                                                            >
                                                                {part}
                                                            </a>
                                                        ) : (
                                                            part
                                                        )
                                                    )}
                                                </span>
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            {/* Input Area */}
                            <form onSubmit={handleSendCommand} className="p-3 border-t border-white/10 bg-white/[0.02] flex gap-2 flex-shrink-0">
                                <div className="relative flex-1">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 font-mono">{'>'}</span>
                                    <Input
                                        value={command}
                                        onChange={(e) => setCommand(e.target.value)}
                                        placeholder={isRunning ? "Escribe un comando..." : "Servidor desconectado"}
                                        disabled={!isRunning}
                                        className="pl-6 bg-black/50 border-white/5 focus:border-purple-500/50 focus:ring-purple-500/20 font-mono text-sm h-10"
                                    />
                                </div>
                                <Button type="submit" disabled={!isRunning || !command.trim()} className="bg-white/10 hover:bg-white/20 text-white w-10 px-0">
                                    <LucideSend className="w-4 h-4" />
                                </Button>
                            </form>
                        </div>
                    </TabsContent>

                    <TabsContent value="dashboard" className="flex-1 min-h-0 overflow-y-auto mt-0">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Card className="bg-zinc-900/40 border-white/5 hover:border-white/10 transition-colors">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                                        <LucideCpu className="w-4 h-4" /> Uso de CPU
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold text-white">
                                        {stats ? `${stats.cpu_usage.toFixed(1)}%` : '-- %'}
                                    </div>
                                    <p className="text-xs text-zinc-500 mt-1">PID: {runningInstances.find(i => i.id === instanceId)?.pid || 'N/A'}</p>
                                </CardContent>
                            </Card>

                            <Card className="bg-zinc-900/40 border-white/5 hover:border-white/10 transition-colors">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                                        <LucideDatabase className="w-4 h-4" /> Memoria RAM
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold text-white">
                                        {stats ? (stats.memory_usage / (1024 * 1024 * 1024)).toFixed(2) : '0.00'} GB
                                        <span className="text-sm text-zinc-500 font-normal ml-1">
                                            / {(ramAllocation / 1024).toFixed(1)} GB
                                        </span>
                                    </div>
                                    <div className="w-full bg-zinc-800 h-1.5 rounded-full mt-3 overflow-hidden">
                                        <div
                                            className="bg-gradient-to-r from-purple-500 to-pink-500 h-full transition-all duration-500 rounded-full shadow-[0_0_10px_rgba(168,85,247,0.4)]"
                                            style={{ width: `${Math.min(100, stats ? (stats.memory_usage / (ramAllocation * 1024 * 1024)) * 100 : 0)}%` }}
                                        />
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="bg-zinc-900/40 border-white/5 hover:border-white/10 transition-colors">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                                        <LucideUsers className="w-4 h-4" /> Jugadores
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold text-white">
                                        {stats?.player_count ?? 0}
                                        <span className="text-sm text-zinc-500 font-normal ml-1">
                                            / {serverProps['max-players'] || '20'}
                                        </span>
                                    </div>
                                    <p className="text-xs text-zinc-500 mt-1">
                                        {stats && stats.player_count > 0 ? `${stats.player_count} conectados` : 'Nadie conectado'}
                                    </p>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    {/* --- FILES TAB --- */}
                    <TabsContent value="files" className="flex-1 min-h-0 mt-0">
                        <Card className="bg-zinc-900/40 border-white/5 h-full flex flex-col">
                            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-white/5 rounded-xl m-4 bg-black/20">
                                <div className="p-4 bg-zinc-800/50 rounded-full mb-4">
                                    <LucideFolder className="w-8 h-8 text-zinc-400" />
                                </div>
                                <h3 className="text-lg font-medium text-white mb-2">Explorador de Archivos</h3>
                                <p className="text-zinc-500 max-w-sm mb-6">Accede a los archivos de configuración, mundos y propiedades del servidor.</p>
                                <Button variant="outline" className="border-white/10 hover:bg-white/5 text-zinc-300" onClick={() => invoke('open_instance_folder', { instanceId })}>
                                    Abrir Carpeta Local
                                </Button>
                            </div>
                        </Card>
                    </TabsContent>

                    {/* --- NETWORK TAB --- */}
                    <TabsContent value="network" className="flex-1 min-h-0 overflow-y-auto mt-0">
                        <Card className="bg-zinc-900/40 border-white/5">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="text-white flex items-center gap-2">
                                            <LucideGlobe className="w-5 h-5 text-indigo-400" /> Playit.gg Tunneling
                                        </CardTitle>
                                        <CardDescription>Permite que otros se conecten sin abrir puertos en tu router.</CardDescription>
                                    </div>
                                    {tunnel.status && (
                                        <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/5 px-3 py-1">
                                            <span className="relative flex h-2 w-2 mr-2">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                            </span>
                                            Túnel Activo
                                        </Badge>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="p-4 rounded-lg bg-black/40 border border-white/5 flex flex-col md:flex-row gap-4 items-center justify-between">
                                    <div className="space-y-1">
                                        <div className="text-sm font-medium text-zinc-300">Control del Túnel</div>
                                        <div className="text-xs text-zinc-500">Inicia el agente de playit.gg junto con tu servidor.</div>
                                    </div>
                                    <Button
                                        onClick={() => tunnel.status ? tunnel.stop() : tunnel.start("playit")}
                                        variant={tunnel.status ? "destructive" : "default"}
                                        disabled={!isRunning}
                                        className={cn(
                                            "min-w-[140px] transition-all",
                                            !tunnel.status && "bg-indigo-600 hover:bg-indigo-500"
                                        )}
                                    >
                                        {tunnel.status ? "Detener Túnel" : "Iniciar Público"}
                                    </Button>
                                </div>

                                {tunnel.status && (
                                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                        <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-4">
                                            <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider mb-3">Dirección Pública</h4>

                                            {tunnel.claimUrl ? (
                                                <div className="flex flex-col gap-2">
                                                    <div className="flex items-start gap-3 bg-indigo-500/10 p-3 rounded text-indigo-200 text-sm">
                                                        <span className="text-xl">👋</span>
                                                        <div>
                                                            <p className="font-bold mb-1">¡Casi listo!</p>
                                                            <p className="opacity-90 mb-2">Necesitas vincular este túnel con tu cuenta de Playit.gg para obtener una IP fija.</p>
                                                            <a
                                                                href={tunnel.claimUrl}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="inline-block bg-indigo-600 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-indigo-500 transition-colors"
                                                            >
                                                                Vincular Ahora &rarr;
                                                            </a>
                                                        </div>
                                                    </div>
                                                    <div className="text-[10px] text-zinc-500 font-mono mt-1 break-all select-all">
                                                        Link manual: {tunnel.claimUrl}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 rounded bg-indigo-900/50 flex items-center justify-center text-indigo-400">
                                                        <LucideGlobe className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm text-zinc-400">Revisa la consola abajo para ver tu dirección asignada.</p>
                                                        <p className="text-xs text-zinc-600">Ejemplo: <code>gato-loco.gl.joinmc.link</code></p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-medium text-zinc-500 uppercase">Salida del Agente</span>
                                                <Badge variant="secondary" className="text-[10px] h-5 bg-zinc-800 text-zinc-400">Log</Badge>
                                            </div>
                                            <div className="bg-[#0c0c0c] p-3 rounded-lg border border-white/5 h-32 overflow-y-auto font-mono text-xs text-zinc-400 custom-scrollbar shadow-inner">
                                                {tunnel.logs.length === 0 ? (
                                                    <span className="opacity-50 italic">Iniciando agente...</span>
                                                ) : (
                                                    tunnel.logs.map((l, i) => {
                                                        const urlRegex = /(https?:\/\/[^\s]+)/g;
                                                        const parts = l.split(urlRegex);
                                                        return (
                                                            <div key={i} className="whitespace-pre-wrap mb-1">
                                                                {parts.map((part, index) =>
                                                                    urlRegex.test(part) ? (
                                                                        <a
                                                                            key={index}
                                                                            href={part}
                                                                            target="_blank"
                                                                            rel="noreferrer"
                                                                            className="text-indigo-400 hover:underline"
                                                                        >
                                                                            {part}
                                                                        </a>
                                                                    ) : (
                                                                        part
                                                                    )
                                                                )}
                                                            </div>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* --- SETTINGS TAB --- */}
                    <TabsContent value="settings" className="flex-1 min-h-0 overflow-y-auto mt-0">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Card className="bg-zinc-900/40 border-white/5">
                                <CardHeader>
                                    <CardTitle className="text-sm font-bold uppercase tracking-wider text-zinc-400">Propiedades del Servidor</CardTitle>
                                    <CardDescription>Configuración básica de server.properties</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex items-center justify-between p-3 rounded-lg bg-black/20 border border-white/5">
                                        <div className="space-y-0.5">
                                            <Label className="text-zinc-200">Whitelist</Label>
                                            <p className="text-[10px] text-zinc-500">Solo usuarios en la lista pueden entrar</p>
                                        </div>
                                        <Switch
                                            checked={serverProps['white-list'] === 'true'}
                                            onCheckedChange={(val) => handlePropertyChange('white-list', val.toString())}
                                        />
                                    </div>

                                    <div className="flex items-center justify-between p-3 rounded-lg bg-black/20 border border-white/5">
                                        <div className="space-y-0.5">
                                            <Label className="text-zinc-200">Online Mode</Label>
                                            <p className="text-[10px] text-zinc-500">Valida cuentas con Mojang (Premium)</p>
                                        </div>
                                        <Switch
                                            checked={serverProps['online-mode'] === 'true'}
                                            onCheckedChange={(val) => handlePropertyChange('online-mode', val.toString())}
                                        />
                                    </div>

                                    <div className="grid gap-2 p-3 rounded-lg bg-black/20 border border-white/5">
                                        <Label className="text-zinc-200 text-xs">Máximo de Jugadores</Label>
                                        <Input
                                            type="number"
                                            value={serverProps['max-players'] || '20'}
                                            onChange={(e) => handlePropertyChange('max-players', e.target.value)}
                                            className="bg-black/40 border-white/5 h-8 text-xs"
                                        />
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="bg-zinc-900/40 border-white/5">
                                <CardHeader>
                                    <CardTitle className="text-sm font-bold uppercase tracking-wider text-zinc-400">Configuración Java</CardTitle>
                                    <CardDescription>Ajusta los recursos asignados a esta instancia</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="grid gap-2">
                                        <label className="text-sm font-medium text-zinc-300">Memoria RAM (MB)</label>
                                        <div className="flex items-center gap-4">
                                            <Input
                                                type="number"
                                                value={ramAllocation}
                                                onChange={(e) => {
                                                    const val = parseInt(e.target.value);
                                                    setRamAllocation(val);
                                                    invoke('set_config_value', { key: 'ramAllocation', value: val });
                                                }}
                                                className="bg-black/20 border-white/10 w-40"
                                            />
                                            <span className="text-sm text-zinc-500">Recomendado: 4096 MB para Modpacks</span>
                                        </div>
                                    </div>
                                    <div className="grid gap-2">
                                        <label className="text-sm font-medium text-zinc-300">Argumentos Java</label>
                                        <Input defaultValue="-Xmx4G -Xms4G" className="bg-black/20 border-white/10 font-mono text-sm" />
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>

            <EulaDialog
                isOpen={showEulaDialog}
                onClose={() => setShowEulaDialog(false)}
                onAccept={handleAcceptEula}
            />
        </div>
    );
};