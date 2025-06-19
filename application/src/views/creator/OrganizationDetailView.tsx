import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Building2, Users, Package, Settings, LucideEdit2 } from "lucide-react";

export const OrganizationDetailView = () => {
    const params = useParams<{ id: string }>();
    // Mock de datos de organización
    const org = {
        id: params.id,
        name: "MineCraft Studios",
        description: "Creadores de modpacks de aventura épicos",
        members: 12,
        modpacks: 5,
        role: "Administrador",
    };

    return (
        <div className="p-8">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">{org.name}</h1>
                    <p className="text-gray-600">{org.description}</p>
                </div>
                <Button variant="outline" className="flex items-center gap-2">
                    <LucideEdit2 size={18} /> Editar
                </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white p-6 rounded-lg border border-gray-200 flex items-center gap-4">
                    <Users className="h-8 w-8 text-blue-500" />
                    <div>
                        <p className="text-sm text-gray-600">Miembros</p>
                        <p className="text-xl font-bold text-gray-900">{org.members}</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-lg border border-gray-200 flex items-center gap-4">
                    <Package className="h-8 w-8 text-green-500" />
                    <div>
                        <p className="text-sm text-gray-600">Modpacks</p>
                        <p className="text-xl font-bold text-gray-900">{org.modpacks}</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-lg border border-gray-200 flex items-center gap-4">
                    <Settings className="h-8 w-8 text-neutral-500" />
                    <div>
                        <p className="text-sm text-gray-600">Rol</p>
                        <p className="text-xl font-bold text-gray-900 capitalize">{org.role}</p>
                    </div>
                </div>
            </div>
            <div className="flex gap-4 mt-8">
                <Button asChild variant="secondary">
                    <a href={`/creators/organizations/${org.id}/members`}>
                        <Users size={18} className="mr-2" /> Gestionar miembros
                    </a>
                </Button>
                <Button asChild variant="secondary">
                    <a href={`/creators/organizations/${org.id}/modpacks`}>
                        <Package size={18} className="mr-2" /> Ver modpacks
                    </a>
                </Button>
                <Button asChild variant="secondary">
                    <a href={`/creators/organizations/${org.id}/settings`}>
                        <Settings size={18} className="mr-2" /> Configuración
                    </a>
                </Button>
            </div>
        </div>
    );
};
