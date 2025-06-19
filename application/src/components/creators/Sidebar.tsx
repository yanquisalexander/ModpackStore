import { Building2, Package, Users, Settings, LucideLayers, LucideEdit2, ChevronLeft } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";

export type SidebarContext =
    | { type: "root" }
    | { type: "organization"; orgId: string }
    | { type: "modpack"; orgId?: string; modpackId: string };

interface SidebarProps {
    context: SidebarContext;
}

export const CreatorsSidebar: React.FC<SidebarProps> = ({ context }) => {
    const [location, setLocation] = useLocation();

    // Mock de organizaciones
    const organizations = [
        { id: "1", name: "MineCraft Studios" },
        { id: "2", name: "Tech Builders" },
        { id: "3", name: "Magic Realm" },
    ];

    // Selector de organización
    const showOrgSelector = context.type === "root" || context.type === "organization";
    const selectedOrgId = context.type === "organization" ? context.orgId : undefined;

    // Botón de volver
    const showBackButton = context.type !== "root";
    const handleBack = () => {
        if (context.type === "organization") setLocation("/creators/organizations");
        else if (context.type === "modpack" && context.orgId) setLocation(`/creators/organizations/${context.orgId}/modpacks`);
        else setLocation("/creators");
    };

    let menuItems: { path: string; label: string; icon: any }[] = [];

    if (context.type === "root") {
        menuItems = [
            { path: "/creators", label: "Resumen", icon: Package },
            { path: "/creators/organizations", label: "Organizaciones", icon: Building2 },
            { path: "/creators/modpacks", label: "Modpacks", icon: Package },
            { path: "/creators/settings", label: "Configuración", icon: Settings },
        ];
    } else if (context.type === "organization") {
        menuItems = [
            { path: `/creators/organizations/${context.orgId}`, label: "Resumen", icon: Building2 },
            { path: `/creators/organizations/${context.orgId}/members`, label: "Miembros", icon: Users },
            { path: `/creators/organizations/${context.orgId}/modpacks`, label: "Modpacks", icon: Package },
            { path: `/creators/organizations/${context.orgId}/settings`, label: "Configuración", icon: Settings },
        ];
    } else if (context.type === "modpack") {
        menuItems = [
            { path: `/creators/modpacks/${context.modpackId}`, label: "Resumen", icon: Package },
            { path: `/creators/modpacks/${context.modpackId}/versions`, label: "Versiones", icon: LucideLayers },
            { path: `/creators/modpacks/${context.modpackId}/edit`, label: "Editar", icon: LucideEdit2 },
            { path: `/creators/modpacks/${context.modpackId}/settings`, label: "Configuración", icon: Settings },
        ];
    }

    return (
        <div className="bg-ms-primary border-r border-neutral-800 overflow-y-auto max-h-dvh h-full sticky top-0 min-w-[220px]">
            <div className="p-4 flex flex-col gap-4">
                {showBackButton && (
                    <button onClick={handleBack} className="flex items-center gap-2 text-neutral-400 hover:text-white mb-2">
                        <ChevronLeft size={18} /> Volver
                    </button>
                )}
                {showOrgSelector && (
                    <Select
                        value={selectedOrgId}
                        onValueChange={val => setLocation(`/creators/organizations/${val}`)}
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Selecciona una organización" />
                        </SelectTrigger>
                        <SelectContent>
                            {organizations.map(org => (
                                <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
                <nav className="space-y-2 mt-2">
                    {menuItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location === item.path;
                        return (
                            <Link
                                key={item.path}
                                href={item.path}
                                className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${isActive
                                    ? "bg-blue-500/10 text-blue-500 font-medium"
                                    : "text-neutral-300 hover:bg-neutral-800"
                                    }`}
                            >
                                <Icon size={20} />
                                <span>{item.label}</span>
                            </Link>
                        );
                    })}
                </nav>
            </div>
        </div>
    );
};
