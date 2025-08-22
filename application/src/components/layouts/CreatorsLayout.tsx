import { useGlobalContext } from "@/stores/GlobalContext";
import {
    LucidePencilRuler,
    Home,
    Settings,
    Users,
    Package, // Icono para Modpacks
    ArrowLeft, // Icono para volver
} from "lucide-react";
import { useEffect } from "react";
import { Link, Route, Switch, useRoute } from "wouter";

export const CreatorsLayout = () => {
    const { setTitleBarState } = useGlobalContext();

    // Hook para detectar si estamos en la ruta de una organización
    const [isOrgRoute, params] = useRoute("/creators/org/:orgId/:rest*");

    // --- Definición de los elementos de navegación ---

    // Navegación base para el dashboard de creadores
    const baseNavItems = [
        { path: "/creators", label: "Inicio", icon: Home },
        { path: "/creators/settings", label: "Configuración", icon: Settings },
        // Aquí podrías agregar un link para ver tus organizaciones
    ];

    // Navegación contextual para cuando estás dentro de una organización
    const orgNavItems = [
        {
            path: `/creators/org/${params?.orgId}`,
            label: "Inicio de la Org",
            icon: Home,
        },
        {
            path: `/creators/org/${params?.orgId}/modpacks`,
            label: "Modpacks",
            icon: Package,
        },
        {
            path: `/creators/org/${params?.orgId}/members`,
            label: "Miembros",
            icon: Users,
        },
        {
            path: `/creators/org/${params?.orgId}/settings`,
            label: "Configuración",
            icon: Settings,
            // Ejemplo de lógica de roles:
            // show: user.role === 'admin' // Suponiendo que tienes info del usuario
        },
    ];

    // Selecciona el menú de navegación a mostrar
    const navItems = isOrgRoute ? orgNavItems : baseNavItems;

    // Actualiza el estado de la barra de título dinámicamente
    useEffect(() => {
        if (isOrgRoute) {
            setTitleBarState({
                title: `Org: ${params.orgId}`, // Título dinámico con el ID de la org
                canGoBack: {
                    history: true,
                },
                opaque: true,
                icon: Users, // Icono representativo de una organización
                customIconClassName: "text-green-500",
            });
        } else {
            setTitleBarState({
                title: "Creators Dashboard",
                canGoBack: true,
                opaque: true,
                icon: LucidePencilRuler,
                customIconClassName: "text-blue-500",
            });
        }
    }, [isOrgRoute, params]); // Se ejecuta cuando cambia la ruta

    return (
        <div className="flex min-h-screen bg-[#202020] text-gray-100">
            {/* Sidebar */}
            <aside className="fixed left-0 top-9 h-[calc(100vh-2.25rem)] w-64 bg-ms-primary shadow-lg flex flex-col border-r border-zinc-800">
                <div className="h-16 flex items-center justify-center border-b border-zinc-800">
                    <h1 className="text-xl font-bold text-blue-500 flex items-center gap-2">
                        {isOrgRoute ? (
                            <>
                                <Users className="w-5 h-5 text-green-500" />
                                {params.orgId}
                            </>
                        ) : (
                            <>
                                <LucidePencilRuler className="w-5 h-5" />
                                Creators
                            </>
                        )}
                    </h1>
                </div>

                <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
                    {/* Botón para volver al dashboard principal si estás en una org */}
                    {isOrgRoute && (
                        <Link href="/creators">
                            <a className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-400 hover:bg-zinc-700/50 hover:text-gray-200 transition mb-4 border border-zinc-700">
                                <ArrowLeft className="w-5 h-5" />
                                Todos los paneles
                            </a>
                        </Link>
                    )}

                    {navItems.map((item) => (
                        // Aquí podrías agregar la lógica de roles:
                        // item.show === false ? null : ( ... )
                        <Link key={item.path} href={item.path}>
                            <a className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-300 hover:bg-blue-500/20 hover:text-blue-400 transition">
                                <item.icon className="w-5 h-5" />
                                {item.label}
                            </a>
                        </Link>
                    ))}
                </nav>
            </aside>

            {/* Content */}
            <main className="flex-1 ml-64 pt-9 p-8">
                {/* Rutas Base */}
                <Route
                    path="/creators"
                    component={() => (
                        <div className="text-lg font-medium">
                            🏠 Bienvenido al panel de Creadores
                        </div>
                    )}
                />
                <Route
                    path="/creators/settings"
                    component={() => (
                        <div className="text-lg font-medium">⚙️ Configuración General</div>
                    )}
                />

                {/* Rutas de Organización (anidadas) */}
                <Route path="/creators/org/:orgId">
                    {(params) => (
                        <div className="text-lg font-medium">
                            🏠 Inicio de la Organización: {params.orgId}
                        </div>
                    )}
                </Route>
                <Route path="/creators/org/:orgId/modpacks">
                    {(params) => (
                        <div className="text-lg font-medium">
                            📦 Modpacks de {params.orgId}
                        </div>
                    )}
                </Route>
                <Route path="/creators/org/:orgId/members">
                    {(params) => (
                        <div className="text-lg font-medium">
                            👥 Miembros de {params.orgId}
                        </div>
                    )}
                </Route>
                <Route path="/creators/org/:orgId/settings">
                    {(params) => (
                        <div className="text-lg font-medium">
                            ⚙️ Configuración de {params.orgId}
                        </div>
                    )}
                </Route>
            </main>
        </div>
    );
};