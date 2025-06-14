import { useGlobalContext } from "@/stores/GlobalContext";
import { MyModpacksView } from "@/views/creator/MyModpacksView";
import { ManageModpackVersionsView } from "@/views/creator/ManageModpackVersionsView"; // Import the new versions view
import { LucideBugPlay, Building2, Package, Users, Settings, Plus, Search, Filter, Grid, List } from "lucide-react";
import { useEffect, useState } from "react";
import { Route, Switch, Link, useLocation } from "wouter";

// Componente principal del Centro de Creadores
export const CreatorsLayout = () => {
    const {
        titleBarState,
        setTitleBarState,
    } = useGlobalContext();

    useEffect(() => {
        setTitleBarState({
            ...titleBarState,
            title: "Centro de Creadores",
            canGoBack: true,
            icon: LucideBugPlay,
            customIconClassName: "text-blue-500 bg-blue-100",
        });
    }, []);

    return (
        <div className="flex h-dvh">
            {/* Sidebar de navegación - Fijo */}
            <CreatorsSidebar />

            {/* Contenido principal - Con scroll independiente */}
            <div className="overflow-auto h-screen">
                <Switch>
                    <Route path="/creators" component={CreatorsOverview} />
                    <Route path="/creators/organizations" component={OrganizationsView} />
                    <Route path="/creators/organizations/:id" component={OrganizationDetail} />
                    <Route path="/creators/modpacks" component={MyModpacksView} />
                    <Route path="/creators/modpacks/:modpackId/versions" component={ManageModpackVersionsView} /> {/* New Route */}
                    {/* The old /creators/modpacks/:id (ModpackDetail) is replaced or needs a new path if it's for general details vs version management */}
                    <Route path="/creators/settings" component={CreatorsSettings} />
                </Switch>
            </div>
        </div>
    );
};

// Sidebar de navegación - Ahora completamente fijo
const CreatorsSidebar = () => {
    const [location] = useLocation();

    const menuItems = [
        { path: "/creators", label: "Resumen", icon: Grid },
        { path: "/creators/organizations", label: "Organizaciones", icon: Building2 },
        { path: "/creators/modpacks", label: "Modpacks", icon: Package },
        { path: "/creators/settings", label: "Configuración", icon: Settings },
    ];

    return (
        <div className="bg-ms-primary border-r border-neutral-800 overflow-y-auto max-h-dvh h-full sticky top-0">
            <div className="p-4">
                <nav className="space-y-2">
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

// Vista de resumen
const CreatorsOverview = () => {
    return (
        <div className="p-6">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                    Bienvenido al Centro de Creadores
                </h1>
                <p className="text-gray-600">
                    Administra tus organizaciones y modpacks de Minecraft desde un solo lugar
                </p>
            </div>

            {/* Estadísticas rápidas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white p-6 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-600">Organizaciones</p>
                            <p className="text-2xl font-bold text-gray-900">3</p>
                        </div>
                        <Building2 className="h-8 w-8 text-blue-500" />
                    </div>
                </div>
                <div className="bg-white p-6 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-600">Modpacks</p>
                            <p className="text-2xl font-bold text-gray-900">12</p>
                        </div>
                        <Package className="h-8 w-8 text-green-500" />
                    </div>
                </div>
                <div className="bg-white p-6 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-600">Miembros</p>
                            <p className="text-2xl font-bold text-gray-900">45</p>
                        </div>
                        <Users className="h-8 w-8 text-purple-500" />
                    </div>
                </div>
            </div>

            {/* Acciones rápidas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-lg border border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Acciones Rápidas</h3>
                    <div className="space-y-3">
                        <Link href="/creators/organizations">
                            <button className="w-full flex items-center justify-between p-3 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                                <div className="flex items-center space-x-3">
                                    <Building2 className="h-5 w-5 text-blue-500" />
                                    <span>Crear nueva organización</span>
                                </div>
                                <Plus className="h-4 w-4 text-gray-400" />
                            </button>
                        </Link>
                        <Link href="/creators/modpacks">
                            <button className="w-full flex items-center justify-between p-3 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                                <div className="flex items-center space-x-3">
                                    <Package className="h-5 w-5 text-green-500" />
                                    <span>Crear nuevo modpack</span>
                                </div>
                                <Plus className="h-4 w-4 text-gray-400" />
                            </button>
                        </Link>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-lg border border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Actividad Reciente</h3>
                    <div className="space-y-3">
                        <div className="flex items-center space-x-3 p-2 bg-gray-50 rounded-lg">
                            <Package className="h-4 w-4 text-green-500" />
                            <div className="flex-1">
                                <p className="text-sm font-medium">Modpack "Adventures+" actualizado</p>
                                <p className="text-xs text-gray-500">Hace 2 horas</p>
                            </div>
                        </div>
                        <div className="flex items-center space-x-3 p-2 bg-gray-50 rounded-lg">
                            <Users className="h-4 w-4 text-purple-500" />
                            <div className="flex-1">
                                <p className="text-sm font-medium">Nuevo miembro en "MineCraft Studios"</p>
                                <p className="text-xs text-gray-500">Hace 4 horas</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Vista de organizaciones
const OrganizationsView = () => {
    const [searchTerm, setSearchTerm] = useState("");
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

    // Datos de ejemplo
    const organizations = [
        {
            id: "1",
            name: "MineCraft Studios",
            description: "Creadores de modpacks de aventura épicos",
            members: 12,
            modpacks: 5,
            avatar: "🏰",
            role: "Administrador"
        },
        {
            id: "2",
            name: "Tech Builders",
            description: "Especialistas en modpacks tecnológicos",
            members: 8,
            modpacks: 3,
            avatar: "⚙️",
            role: "Miembro"
        },
        {
            id: "3",
            name: "Magic Realm",
            description: "Enfocados en magia y misticismo",
            members: 15,
            modpacks: 4,
            avatar: "🔮",
            role: "Moderador"
        }
    ];

    const filteredOrganizations = organizations.filter(org =>
        org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        org.description.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Organizaciones</h1>
                    <p className="text-gray-600">Administra tus organizaciones y equipos</p>
                </div>
                <button className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                    <Plus size={20} />
                    <span>Nueva Organización</span>
                </button>
            </div>

            {/* Controles de búsqueda y vista */}
            <div className="flex flex-col sm:flex-row justify-between items-center mb-6 space-y-4 sm:space-y-0">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Buscar organizaciones..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>
                <div className="flex items-center space-x-2">
                    <button
                        onClick={() => setViewMode("grid")}
                        className={`p-2 rounded-lg ${viewMode === "grid" ? "bg-blue-100 text-blue-600" : "text-gray-400 hover:text-gray-600"}`}
                    >
                        <Grid size={20} />
                    </button>
                    <button
                        onClick={() => setViewMode("list")}
                        className={`p-2 rounded-lg ${viewMode === "list" ? "bg-blue-100 text-blue-600" : "text-gray-400 hover:text-gray-600"}`}
                    >
                        <List size={20} />
                    </button>
                </div>
            </div>

            {/* Lista/Grid de organizaciones */}
            <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "space-y-4"}>
                {filteredOrganizations.map((org) => (
                    <Link key={org.id} href={`/creators/organizations/${org.id}`}>
                        <div className={`bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer ${viewMode === "list" ? "flex items-center space-x-4" : ""
                            }`}>
                            <div className={`text-4xl mb-4 ${viewMode === "list" ? "mb-0" : ""}`}>
                                {org.avatar}
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-lg font-semibold text-gray-900">{org.name}</h3>
                                    <span className={`px-2 py-1 text-xs rounded-full ${org.role === "Administrador" ? "bg-red-100 text-red-800" :
                                        org.role === "Moderador" ? "bg-yellow-100 text-yellow-800" :
                                            "bg-green-100 text-green-800"
                                        }`}>
                                        {org.role}
                                    </span>
                                </div>
                                <p className="text-gray-600 text-sm mb-3">{org.description}</p>
                                <div className="flex items-center space-x-4 text-sm text-gray-500">
                                    <div className="flex items-center space-x-1">
                                        <Users size={16} />
                                        <span>{org.members} miembros</span>
                                    </div>
                                    <div className="flex items-center space-x-1">
                                        <Package size={16} />
                                        <span>{org.modpacks} modpacks</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
};

// The placeholder ModpacksView component is no longer needed as MyModpacksView replaces it.
// If ModpacksView was more than a placeholder, its contents would be merged or adapted.
// For this subtask, MyModpacksView is the intended implementation for /creators/modpacks.

// Detalle de organización (placeholder)
const OrganizationDetail = ({ params }: { params: { id: string } }) => {
    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
                Detalle de Organización #{params.id}
            </h1>
            <p className="text-gray-600">
                Aquí se mostraría la información detallada de la organización, incluyendo miembros, modpacks, configuración, etc.
            </p>
        </div>
    );
};

// Detalle de modpack (placeholder) - This can be removed if ManageModpackVersionsView serves as the detail/management page
// Or it can be kept if it's for a different purpose, but the route /creators/modpacks/:id would need to be distinct
// from /creators/modpacks/:modpackId/versions. For now, let's assume ManageModpackVersionsView is the primary view for a specific modpack.
// const ModpackDetail = ({ params }: { params: { id: string } }) => {
//     return (
//         <div className="p-6">
//             <h1 className="text-2xl font-bold text-gray-900 mb-4">
//                 Detalle de Modpack #{params.id}
//             </h1>
//             <p className="text-gray-600">
//                 Aquí se mostraría la información detallada del modpack, incluyendo mods, versiones, configuración, estadísticas, etc.
//             </p>
//         </div>
//     );
// };

// Configuración del centro de creadores (placeholder)
const CreatorsSettings = () => {
    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
                Configuración del Centro de Creadores
            </h1>
            <p className="text-gray-600">
                Aquí se mostrarían las opciones de configuración para el centro de creadores.
            </p>
        </div>
    );
};