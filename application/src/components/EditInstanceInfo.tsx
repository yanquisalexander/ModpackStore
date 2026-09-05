import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import {
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
import { Switch } from "@/components/ui/switch";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { TauriCommandReturns } from "@/types/TauriCommandReturns";

interface EditInstanceInfoProps {
    instanceId: string;
    onUpdate?: () => void;
    defaultShowEditInfo?: boolean;
}

export const EditInstanceInfo = ({ instanceId, onUpdate, defaultShowEditInfo }: EditInstanceInfoProps) => {
    const [open, setOpen] = useState(defaultShowEditInfo || false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoadingData, setIsLoadingData] = useState(true);

    const [instance, setInstance] = useState<TauriCommandReturns['get_instance_by_id'] | null>(null);
    const [accounts, setAccounts] = useState<TauriCommandReturns['get_all_accounts']>([]);

    const [formData, setFormData] = useState({
        instanceName: "",
        selectedAccountValue: "",
        useModpackStoreAuth: false,
    });

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
                    setFormData({
                        instanceName: instanceData.instanceName || "",
                        selectedAccountValue: instanceData.accountUuid || "",
                        useModpackStoreAuth: instanceData.useModpackStoreAuth || false,
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
    }, [open, instanceId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.instanceName.trim()) return toast.warning("El nombre es obligatorio");

        setIsSubmitting(true);
        try {
            const payload = {
                ...instance,
                instanceName: formData.instanceName,
                accountUuid: formData.selectedAccountValue || null,
                useModpackStoreAuth: formData.useModpackStoreAuth,
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

    const renderAccountIcon = (isOffline: boolean) => (
        <div className={`p-1 rounded-md ${isOffline ? "bg-neutral-500/20" : "bg-blue-500/20"}`}>
            {isOffline
                ? <LucideGamepad2 className="size-3.5 text-neutral-400" />
                : <LucideUser className="size-3.5 text-blue-400" />
            }
        </div>
    );

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <button className="flex items-center gap-3 w-full px-3 py-2 text-sm text-neutral-400 hover:text-white hover:bg-white/[0.04] cursor-pointer transition-colors">
                    <LucidePencil className="size-4 shrink-0" />
                    Editar Información
                </button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-[440px] p-0 gap-0 border-white/[0.06] bg-[#0e0e10]">

                <div className="p-6 pb-4 border-b border-white/[0.04]">
                    <DialogHeader className="space-y-1">
                        <DialogTitle className="text-lg font-semibold text-white">
                            Editar Instancia
                        </DialogTitle>
                        <p className="text-sm text-neutral-500">
                            Ajusta los detalles principales de tu juego.
                        </p>
                    </DialogHeader>
                </div>

                <div className="p-6 space-y-5">
                    {isLoadingData ? (
                        <div className="flex flex-col items-center justify-center py-10 gap-3 text-neutral-600">
                            <LucideLoader2 className="animate-spin size-6" />
                            <span className="text-xs font-medium tracking-wider uppercase">Cargando...</span>
                        </div>
                    ) : (
                        <form id="edit-instance-form" onSubmit={handleSubmit} className="space-y-5">

                            <div className="space-y-1.5">
                                <Label htmlFor="name" className="text-xs font-medium text-neutral-500 ml-1">Nombre</Label>
                                <Input
                                    id="name"
                                    value={formData.instanceName}
                                    onChange={(e) => setFormData(prev => ({ ...prev, instanceName: e.target.value }))}
                                    className="h-10 bg-black/20 border-white/[0.06] text-white placeholder:text-neutral-700 focus:border-white/10 rounded-lg transition-colors"
                                    placeholder="Mi Mundo Épico"
                                />
                            </div>

                            <div className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-black/20 px-4 py-3">
                                <div className="space-y-0.5">
                                    <Label className="text-sm text-white cursor-pointer">Usar servicios de autenticación de Modpack Store</Label>
                                    <p className="text-xs text-neutral-500">
                                        {formData.useModpackStoreAuth
                                            ? "Se utilizarán los servicios de autenticación de Modpack Store para iniciar sesión en Minecraft"
                                            : "Se usará la cuenta local directamente"}
                                    </p>
                                </div>
                                <Switch
                                    checked={formData.useModpackStoreAuth}
                                    onCheckedChange={(checked) => setFormData(prev => ({
                                        ...prev,
                                        useModpackStoreAuth: checked,
                                        selectedAccountValue: "",
                                    }))}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs font-medium text-neutral-500 ml-1">
                                    Cuenta
                                </Label>
                                <Select
                                    value={formData.selectedAccountValue}
                                    onValueChange={(val) => setFormData(prev => ({ ...prev, selectedAccountValue: val }))}
                                >
                                    <SelectTrigger className="h-10 bg-black/20 border-white/[0.06] text-white focus:ring-0 focus:border-white/10 rounded-lg">
                                        <SelectValue placeholder="Seleccionar cuenta" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-[#121214] border-white/[0.06] text-white rounded-lg">
                                        {accounts.length === 0 && (
                                            <div className="px-3 py-4 text-center text-sm text-neutral-600">
                                                No hay cuentas vinculadas
                                            </div>
                                        )}
                                        {accounts.map((acc) => {
                                            const isOffline = acc.user_type.toLowerCase() === "offline";
                                            return (
                                                <SelectItem key={acc.uuid} value={acc.uuid} className="focus:bg-white/[0.04] cursor-pointer">
                                                    <div className="flex items-center gap-2">
                                                        {renderAccountIcon(isOffline)}
                                                        <span className="text-sm">{acc.username}</span>
                                                    </div>
                                                </SelectItem>
                                            );
                                        })}
                                    </SelectContent>
                                </Select>
                            </div>
                        </form>
                    )}
                </div>

                <div className="p-6 pt-0 flex gap-3">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setOpen(false)}
                        className="flex-1 h-10 rounded-lg bg-transparent hover:bg-white/[0.04] text-neutral-500 hover:text-white text-sm transition-colors"
                    >
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        form="edit-instance-form"
                        disabled={isSubmitting || isLoadingData}
                        className="flex-[2] h-10 rounded-lg bg-white text-black hover:bg-white/90 text-sm font-semibold transition-colors disabled:opacity-50"
                    >
                        {isSubmitting ? <LucideLoader2 className="animate-spin size-4 mr-2" /> : <LucideSave className="size-4 mr-2" />}
                        Guardar Cambios
                    </Button>
                </div>

            </DialogContent>
        </Dialog>
    );
};
