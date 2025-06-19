import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { LucideEdit2, LucideLayers, Users, Settings } from "lucide-react";

export const ModpackDetailView = () => {
    const params = useParams<{ modpackId: string }>();
    // Aquí puedes obtener datos reales o mock
    const modpack = {
        id: params.modpackId,
        name: "Super Modpack",
        description: "Un modpack de ejemplo para mostrar la UI contextual.",
        status: "published",
        collaborators: 3,
        versions: 5,
    };

    return (
        <div className="p-8">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">{modpack.name}</h1>
                    <p className="text-gray-600">{modpack.description}</p>
                </div>
                <Button variant="outline" className="flex items-center gap-2">
                    <LucideEdit2 size={18} /> Editar
                </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white p-6 rounded-lg border border-gray-200 flex items-center gap-4">
                    <LucideLayers className="h-8 w-8 text-blue-500" />
                    <div>
                        <p className="text-sm text-gray-600">Versiones</p>
                        <p className="text-xl font-bold text-gray-900">{modpack.versions}</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-lg border border-gray-200 flex items-center gap-4">
                    <Users className="h-8 w-8 text-green-500" />
                    <div>
                        <p className="text-sm text-gray-600">Colaboradores</p>
                        <p className="text-xl font-bold text-gray-900">{modpack.collaborators}</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-lg border border-gray-200 flex items-center gap-4">
                    <Settings className="h-8 w-8 text-neutral-500" />
                    <div>
                        <p className="text-sm text-gray-600">Estado</p>
                        <p className="text-xl font-bold text-gray-900 capitalize">{modpack.status}</p>
                    </div>
                </div>
            </div>
            <div className="flex gap-4 mt-8">
                <Button asChild variant="secondary">
                    <a href={`/creators/modpacks/${modpack.id}/versions`}>
                        <LucideLayers size={18} className="mr-2" /> Gestionar versiones
                    </a>
                </Button>
                <Button asChild variant="secondary">
                    <a href="#colaboradores">
                        <Users size={18} className="mr-2" /> Colaboradores
                    </a>
                </Button>
                <Button asChild variant="secondary">
                    <a href={`/creators/modpacks/${modpack.id}/edit`}>
                        <LucideEdit2 size={18} className="mr-2" /> Editar modpack
                    </a>
                </Button>
            </div>
        </div>
    );
};
