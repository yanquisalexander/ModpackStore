import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import {
    LucideCpu,
    LucidePencil,
    LucideSave,
    LucideUser,
    LucideGamepad2,
    LucideLoader2
} from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useAuthentication } from "@/stores/AuthContext";
import { TauriCommandReturns } from "@/types/TauriCommandReturns";

interface EditInstanceInfoProps {
    instanceId: string;
    onUpdate?: () => void;
    defaultShowEditInfo?: boolean;
}

const ACCOUNT_OFFLINE_VALUE = "offline_mode";

export const EditInstanceInfo = ({ instanceId, onUpdate, defaultShowEditInfo }: EditInstanceInfoProps) => {
    const [open, setOpen] = useState(defaultShowEditInfo || false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoadingData, setIsLoadingData] = useState(true);

    const [instance, setInstance] = useState<TauriCommandReturns['get_instance_by_id'] | null>(null);
    const [accounts, setAccounts] = useState<TauriCommandReturns['get_all_accounts']>([]);

    const [formData, setFormData] = useState({
        instanceName: "",
        selectedAccountValue: "",
        customNickname: "",
    });

    const { session } = useAuthentication();

    useEffect(() => {
        if (!open) return;

        const fetchData = async () => {
            setIsLoadingData(true);
            try {
                const [instanceData, accountsData] = await Promise.all([
                    invoke<TauriCommandReturns['get_instance_by_id']>("get_instance_by_id", { instanceId }),
                    invoke<TauriCommandReturns['get_all_accounts']>("get_all_accounts")
                ]);

                if (instanceData) {
                    setInstance(instanceData);
                    const isOffline = instanceData.accountUuid === null;
                    const initialNickname = instanceData.ms_nickname || session?.username || "";

                    setFormData({
                        instanceName: instanceData.instanceName || "",
                        selectedAccountValue: isOffline ? ACCOUNT_OFFLINE_VALUE : instanceData.accountUuid!,
                        customNickname: initialNickname,
                    });
                }
                setAccounts(accountsData);
            } catch (error) {
                console.error(error);
                toast.error("Error de carga", { description: "No se pudieron obtener los datos." });
                setOpen(false);
            } finally {
                setIsLoadingData(false);
            }
        };

        fetchData();
    }, [open, instanceId, session]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.instanceName.trim()) return toast.warning("El nombre es obligatorio");

        setIsSubmitting(true);
        try {
            const isOfflineSelection = formData.selectedAccountValue === ACCOUNT_OFFLINE_VALUE;
            const payload = {
                ...instance,
                instanceName: formData.instanceName,
                accountUuid: isOfflineSelection ? null : formData.selectedAccountValue,
                ms_nickname: isOfflineSelection ? (formData.customNickname || session?.username) : null,
            };

            await invoke("update_instance", { instance: payload });
            toast.success("Instancia actualizada");
            if (onUpdate) onUpdate();
            setOpen(false);
        } catch (error) {
            console.error(error);
            toast.error("Error al guardar cambios");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {/* CONSISTENCIA: Botón de estilo menú estándar */}
                <button
                    className="group flex items-center gap-x-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 text-neutral-200 hover:bg-white/10 hover:text-white cursor-pointer"
                >
                    <LucidePencil className="size-4 text-neutral-400 group-hover:text-white" />
                    Editar Información
                </button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-[440px] p-0 gap-0 overflow-hidden border-white/10 bg-[#09090b]/95 backdrop-blur-xl shadow-2xl">

                {/* --- HEADER --- */}
                <div className="relative p-6 pb-4 border-b border-white/5">
                    <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-blue-500/5 via-transparent to-transparent pointer-events-none" />

                    <DialogHeader className="relative z-10 space-y-1">
                        <DialogTitle className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                            Editar Instancia
                        </DialogTitle>
                        <div className="text-sm text-white/50">
                            Ajusta los detalles principales de tu juego.
                        </div>
                    </DialogHeader>
                </div>

                {/* --- BODY --- */}
                <div className="p-6 space-y-6">
                    {isLoadingData ? (
                        <div className="flex flex-col items-center justify-center py-10 gap-3 text-white/30">
                            <LucideLoader2 className="animate-spin size-8" />
                            <span className="text-xs uppercase tracking-wider font-medium">Cargando...</span>
                        </div>
                    ) : (
                        <form id="edit-instance-form" onSubmit={handleSubmit} className="space-y-5">

                            {/* Alert Info */}
                            <div className="flex gap-3 p-3 rounded-xl bg-blue-500/5 border border-blue-500/10">
                                <LucideCpu className="size-5 text-blue-400/70 shrink-0 mt-0.5" />
                                <div className="space-y-1">
                                    <p className="text-xs font-semibold text-blue-300/90">Rendimiento Global</p>
                                    <p className="text-[11px] leading-relaxed text-white/40">
                                        La asignación de RAM y argumentos de Java se gestionan desde la configuración global.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {/* Input Nombre */}
                                <div className="space-y-1.5">
                                    <Label htmlFor="name" className="text-xs font-bold text-white/40 uppercase tracking-wider ml-1">Nombre</Label>
                                    <Input
                                        id="name"
                                        value={formData.instanceName}
                                        onChange={(e) => setFormData(prev => ({ ...prev, instanceName: e.target.value }))}
                                        className="h-11 bg-white/[0.03] border-white/10 text-white placeholder:text-white/20 focus:bg-white/[0.07] focus:border-blue-500/30 transition-all rounded-xl"
                                        placeholder="Mi Mundo Épico"
                                    />
                                </div>

                                {/* Select Cuenta */}
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-bold text-white/40 uppercase tracking-wider ml-1">Cuenta</Label>
                                    <Select
                                        value={formData.selectedAccountValue}
                                        onValueChange={(val) => setFormData(prev => ({ ...prev, selectedAccountValue: val }))}
                                    >
                                        <SelectTrigger className="h-11 bg-white/[0.03] border-white/10 text-white focus:ring-0 focus:border-white/20 rounded-xl">
                                            <SelectValue placeholder="Seleccionar cuenta" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-[#121212] border-white/10 text-white rounded-xl shadow-xl">
                                            <SelectGroup>
                                                <SelectLabel className="text-white/30 text-[10px] uppercase tracking-wider px-2 py-1.5">Offline</SelectLabel>
                                                <SelectItem value={ACCOUNT_OFFLINE_VALUE} className="focus:bg-white/10 focus:text-white cursor-pointer rounded-lg mx-1">
                                                    <div className="flex items-center gap-2">
                                                        <div className="p-1 bg-purple-500/20 rounded-md">
                                                            <LucideGamepad2 className="size-3.5 text-purple-400" />
                                                        </div>
                                                        <span className="text-sm">Cuenta Local</span>
                                                    </div>
                                                </SelectItem>
                                            </SelectGroup>

                                            {accounts.length > 0 && (
                                                <>
                                                    <div className="h-px bg-white/5 my-1 mx-2" />
                                                    <SelectGroup>
                                                        <SelectLabel className="text-white/30 text-[10px] uppercase tracking-wider px-2 py-1.5">Microsoft</SelectLabel>
                                                        {accounts.map((acc) => (
                                                            <SelectItem key={acc.uuid} value={acc.uuid} className="focus:bg-white/10 focus:text-white cursor-pointer rounded-lg mx-1">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="p-1 bg-emerald-500/20 rounded-md">
                                                                        <LucideUser className="size-3.5 text-emerald-400" />
                                                                    </div>
                                                                    <span className="text-sm">{acc.username}</span>
                                                                </div>
                                                            </SelectItem>
                                                        ))}
                                                    </SelectGroup>
                                                </>
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Input Nickname (Condicional) */}
                                {formData.selectedAccountValue === ACCOUNT_OFFLINE_VALUE && (
                                    <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
                                        <Label htmlFor="nickname" className="text-xs font-bold text-white/40 uppercase tracking-wider ml-1">Nickname</Label>
                                        <Input
                                            id="nickname"
                                            value={formData.customNickname}
                                            onChange={(e) => setFormData(prev => ({ ...prev, customNickname: e.target.value }))}
                                            className="h-11 bg-white/[0.03] border-white/10 text-white placeholder:text-white/20 focus:bg-white/[0.07] focus:border-purple-500/30 transition-all rounded-xl"
                                            placeholder={session?.username || "Steve"}
                                        />
                                    </div>
                                )}
                            </div>
                        </form>
                    )}
                </div>

                {/* --- FOOTER --- */}
                <div className="p-6 pt-0 flex gap-3">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setOpen(false)}
                        className="flex-1 h-11 rounded-xl bg-transparent hover:bg-white/5 text-white/60 hover:text-white border border-transparent hover:border-white/5 transition-all"
                    >
                        Cancelar
                    </Button>
                    {/* CONSISTENCIA: Botón de acción primario estándar */}
                    <Button
                        type="submit"
                        form="edit-instance-form"
                        disabled={isSubmitting || isLoadingData}
                        className="flex-[2] h-11 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium border-0 transition-all hover:scale-[1.01] active:scale-[0.98]"
                    >
                        {isSubmitting ? <LucideLoader2 className="animate-spin size-4 mr-2" /> : <LucideSave className="size-4 mr-2" />}
                        Guardar Cambios
                    </Button>
                </div>

            </DialogContent>
        </Dialog>
    );
};