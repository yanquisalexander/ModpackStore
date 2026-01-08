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
    LucideSend
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { toast } from 'sonner';
import { useGlobalContext } from '@/stores/GlobalContext';
import { useInstances } from '@/stores/InstancesContext';
import type { MinecraftInstance } from '@/types/TauriCommandReturns';

export const ServerDetailView: React.FC = () => {
    const { instanceId } = useParams<{ instanceId: string }>();
    const navigate = useNavigate();
    const { setTitleBarState } = useGlobalContext();
    const { instances: runningInstances } = useInstances();

    const [instance, setInstance] = useState<MinecraftInstance | null>(null);
    const [loading, setLoading] = useState(true);
    const [logs, setLogs] = useState<{ message: string, type: 'stdout' | 'stderr' }[]>([]);
    const [command, setCommand] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);

    const isRunning = runningInstances.some(i => i.id === instanceId && i.status === 'running');

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
                setLogs(prev => [...prev.slice(-499), { message, type }]); // Keep last 500 lines
            }
        });

        return () => {
            unlisten.then(fn => fn());
        };
    }, [instanceId]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs]);

    const handleStart = async () => {
        if (!instance) return;
        try {
            await invoke('launch_mc_instance', { instanceId: instance.instanceId });
            toast.success("Iniciando servidor...");
        } catch (error) {
            toast.error("Error al iniciar el servidor: " + error);
        }
    };

    const handleStop = async () => {
        try {
            await invoke('kill_instance', { instanceId });
            toast.success("Servidor detenido");
        } catch (error) {
            toast.error("Error al detener el servidor");
        }
    };

    const handleSendCommand = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!command.trim() || !isRunning) return;

        try {
            await invoke('send_server_command', { instanceId, command: command.trim() });
            setCommand('');
        } catch (error) {
            toast.error("Error al enviar comando");
        }
    };

    if (loading) return <div className="p-8">Cargando...</div>;
    if (!instance) return null;

    return (
        <div className="flex flex-col h-full bg-[#0a0a0a] text-white">
            {/* Header Content */}
            <div className="p-6 border-b border-white/5 bg-white/5 backdrop-blur-sm">
                <div className="flex items-center justify-between max-w-7xl mx-auto">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
                            <LucideServer className="w-8 h-8 text-purple-400" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-white">{instance.instanceName}</h2>
                            <div className="flex items-center gap-2 mt-1">
                                <Badge variant={isRunning ? "default" : "secondary"} className={isRunning ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/20" : ""}>
                                    {isRunning ? "En línea" : "Desconectado"}
                                </Badge>
                                <span className="text-xs text-neutral-500">•</span>
                                <span className="text-xs text-neutral-400">{instance.minecraftVersion}</span>
                                {instance.loaderType && (
                                    <>
                                        <span className="text-xs text-neutral-500">•</span>
                                        <span className="text-xs text-neutral-400 capitalize">{instance.loaderType}</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {!isRunning ? (
                            <Button onClick={handleStart} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
                                <LucidePlay className="w-4 h-4" /> Iniciar
                            </Button>
                        ) : (
                            <>
                                <Button onClick={() => handleSendCommand({ preventDefault: () => { }, target: { value: 'stop' } } as any)} variant="outline" className="border-orange-500/20 text-orange-400 hover:bg-orange-500/10 gap-2">
                                    <LucideRefreshCcw className="w-4 h-4" /> Reiniciar
                                </Button>
                                <Button onClick={handleStop} variant="destructive" className="gap-2">
                                    <LucideSquare className="w-4 h-4" /> Detener
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-hidden p-6 max-w-7xl mx-auto w-full">
                <Tabs defaultValue="console" className="h-full flex flex-col">
                    <TabsList className="bg-white/5 border border-white/10 w-fit mb-6">
                        <TabsTrigger value="dashboard" className="gap-2"><LucideCpu className="w-4 h-4" /> Dashboard</TabsTrigger>
                        <TabsTrigger value="console" className="gap-2"><LucideTerminal className="w-4 h-4" /> Consola</TabsTrigger>
                        <TabsTrigger value="files" className="gap-2"><LucideFolder className="w-4 h-4" /> Archivos</TabsTrigger>
                        <TabsTrigger value="settings" className="gap-2"><LucideSettings className="w-4 h-4" /> Configuración</TabsTrigger>
                    </TabsList>

                    <TabsContent value="dashboard" className="flex-1 mt-0">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <Card className="bg-white/5 border-white/10">
                                <CardHeader>
                                    <CardTitle className="text-sm font-medium text-neutral-400">Estado</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{isRunning ? "Ejecutándose" : "Apagado"}</div>
                                    <p className="text-xs text-neutral-500 mt-1">PID: {runningInstances.find(i => i.id === instanceId)?.pid || 'N/A'}</p>
                                </CardContent>
                            </Card>
                            <Card className="bg-white/5 border-white/10">
                                <CardHeader>
                                    <CardTitle className="text-sm font-medium text-neutral-400">Uso de Memoria</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">2.4 GB / 4.0 GB</div>
                                    <div className="w-full bg-white/10 h-2 rounded-full mt-2 overflow-hidden">
                                        <div className="bg-purple-500 h-full w-[60%]" />
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="bg-white/5 border-white/10">
                                <CardHeader>
                                    <CardTitle className="text-sm font-medium text-neutral-400">Jugadores</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">0 / 20</div>
                                    <p className="text-xs text-neutral-500 mt-1">Nadie conectado ahora</p>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    <TabsContent value="console" className="flex-1 mt-0 overflow-hidden flex flex-col gap-4">
                        <div className="flex-1 bg-black border border-white/10 rounded-xl overflow-hidden flex flex-col shadow-2xl">
                            <div className="p-2 border-b border-white/5 bg-white/5 flex items-center justify-between">
                                <span className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold ml-2">Salida de Consola</span>
                                <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => setLogs([])}>Limpiar</Button>
                            </div>
                            <div
                                ref={scrollRef}
                                className="flex-1 overflow-y-auto p-4 font-mono text-sm leading-relaxed custom-scrollbar scroll-smooth"
                            >
                                {logs.map((log, i) => (
                                    <div key={i} className={`whitespace-pre-wrap mb-0.5 ${log.type === 'stderr' ? 'text-red-400' : 'text-neutral-300'}`}>
                                        {log.message}
                                    </div>
                                ))}
                                {logs.length === 0 && (
                                    <div className="text-neutral-600 italic">Esperando salida del servidor...</div>
                                )}
                            </div>
                            <form onSubmit={handleSendCommand} className="p-3 border-t border-white/10 bg-white/5 flex gap-2">
                                <Input
                                    value={command}
                                    onChange={(e) => setCommand(e.target.value)}
                                    placeholder={isRunning ? "Escribe un comando..." : "Inicia el servidor para enviar comandos"}
                                    disabled={!isRunning}
                                    className="bg-black/40 border-white/10 focus:ring-purple-500/50"
                                />
                                <Button type="submit" disabled={!isRunning || !command.trim()} className="bg-purple-600 hover:bg-purple-700">
                                    <LucideSend className="w-4 h-4" />
                                </Button>
                            </form>
                        </div>
                    </TabsContent>

                    <TabsContent value="files" className="flex-1 mt-0">
                        <Card className="bg-white/5 border-white/10 h-full">
                            <CardHeader>
                                <CardTitle>Explorador de Archivos</CardTitle>
                                <CardDescription>Gestiona los archivos de tu servidor directamente</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="text-center py-12">
                                    <LucideDatabase className="w-12 h-12 text-neutral-700 mx-auto mb-4" />
                                    <p className="text-neutral-500">Pronto podrás gestionar archivos aquí</p>
                                    <Button variant="outline" className="mt-4 border-white/10" onClick={() => invoke('open_instance_folder', { instanceId })}>
                                        Abrir en el Explorador
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="settings" className="flex-1 mt-0">
                        <Card className="bg-white/5 border-white/10">
                            <CardHeader>
                                <CardTitle>Ajustes del Servidor</CardTitle>
                                <CardDescription>Configura el hardware y entorno Java</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-neutral-300">Asignación de RAM</label>
                                    <div className="flex items-center gap-4">
                                        <Input type="number" defaultValue={4096} className="bg-black/40 border-white/10 w-32" />
                                        <span className="text-neutral-500">MB</span>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-neutral-300">Versión de Java</label>
                                    <Badge variant="outline" className="border-purple-500/30 text-purple-400 bg-purple-500/5">Automático (Java 17)</Badge>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
};
