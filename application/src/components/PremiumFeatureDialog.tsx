import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LucideLayers, LucideShield, LucideHistory, LucideSparkles } from "lucide-react";

interface PlusFeature {
    title: string;
    description: string;
    icon?: React.ReactNode;
}

interface PlusFeatureEvent {
    featureTitle: string;
    featureDescription: string;
}

const PLUS_FEATURES: PlusFeature[] = [
    {
        title: "Más instancias activas",
        description: "Mantené varios entornos de juego sin tener que eliminar ninguno.",
        icon: <LucideLayers className="w-4 h-4" />
    },
    {
        title: "Backups en la nube",
        description: "Protegé tus mundos y configuraciones y restauralos desde cualquier equipo.",
        icon: <LucideShield className="w-4 h-4" />
    },
    {
        title: "Historial de rollback",
        description: "Volvé a versiones anteriores si una actualización no sale como esperabas.",
        icon: <LucideHistory className="w-4 h-4" />
    },
    {
        title: "Funciones en acceso anticipado",
        description: "Probá nuevas herramientas antes de que lleguen a todos.",
        icon: <LucideSparkles className="w-4 h-4" />
    }
];

export const PlusFeatureDialog = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [currentFeature, setCurrentFeature] = useState<PlusFeatureEvent | null>(null);

    useEffect(() => {
        const handlePlusFeatureRequest = (event: Event) => {
            const customEvent = event as CustomEvent<PlusFeatureEvent>;
            setCurrentFeature(customEvent.detail);
            setIsOpen(true);
        };

        window.addEventListener('request-plus-feature', handlePlusFeatureRequest);

        return () => {
            window.removeEventListener('request-plus-feature', handlePlusFeatureRequest);
        };
    }, []);

    const handleClose = () => {
        setIsOpen(false);
        setTimeout(() => setCurrentFeature(null), 300);
    };

    const handleViewPlus = () => {
        // TODO: Navegar a la página de ModpackStore+
        console.log('View ModpackStore+ clicked');
        handleClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0a] border-white/10 text-white sm:max-w-[550px] shadow-2xl p-0 rounded-2xl overflow-hidden">

                {/* Header Compacto */}
                <div className="px-6 pt-6 pb-3 space-y-3">
                    <DialogTitle className="text-xl font-bold">
                        Límite del plan actual
                    </DialogTitle>

                    {currentFeature && (
                        <div className="bg-white/5 border border-white/10 rounded-lg p-3 space-y-1">
                            <h3 className="font-semibold text-sm">
                                {currentFeature.featureTitle}
                            </h3>
                            <DialogDescription className="text-gray-300 text-xs leading-relaxed">
                                {currentFeature.featureDescription}
                            </DialogDescription>
                        </div>
                    )}

                    <DialogDescription className="text-gray-400 text-xs text-center leading-relaxed">
                        Tu plan actual cubre el uso básico. <span className="text-white font-medium">ModpackStore+</span> amplía estos límites.
                    </DialogDescription>
                </div>

                {/* Beneficios en Grid 2x2 */}
                <div className="px-6 pb-4 space-y-2">
                    <div className="text-xs font-medium text-gray-300 text-center uppercase tracking-wider">
                        Incluido en ModpackStore+
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        {PLUS_FEATURES.map((feature, index) => (
                            <div
                                key={index}
                                className="flex flex-col gap-2 p-3 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 rounded-md bg-white/10 text-white shrink-0">
                                        {feature.icon}
                                    </div>
                                    <h4 className="font-medium text-white text-xs leading-tight">
                                        {feature.title}
                                    </h4>
                                </div>
                                <p className="text-[11px] text-gray-400 leading-snug">
                                    {feature.description}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer con acciones */}
                <div className="px-6 pb-6 pt-2 space-y-3 border-t border-white/5">
                    <div className="flex gap-2">
                        <Button
                            onClick={handleClose}
                            variant="outline"
                            className="flex-1 bg-transparent border-white/10 text-white hover:bg-white/5 hover:border-white/20 text-sm h-9"
                        >
                            Entendido
                        </Button>
                        <Button
                            onClick={handleViewPlus}
                            className="flex-1 bg-white text-black hover:bg-gray-200 font-medium text-sm h-9"
                        >
                            Ver ModpackStore+
                        </Button>
                    </div>

                    <p className="text-[10px] text-center text-gray-500">
                        Podés seguir usando Modpack Store sin problemas con tu plan actual.
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    );
};


