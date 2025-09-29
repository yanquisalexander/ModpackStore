// Este componente es una barra lateral
// fija, similar al guild bar de Discord.

import { useAuthentication } from "@/stores/AuthContext";
import { LucideLayoutGrid, LucideLibrary, LucideServer, LucideUsers } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";


// Está pensado para contener iconos de navegación
// y otros elementos de interacción rápida, como
// los modpacks favoritos

export const AppSidebar: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { session } = useAuthentication();

    const NAV_ITEMS = [
        {
            name: "Explorar",
            icon: LucideLayoutGrid,
            path: "/"
        },
        {
            name: "Biblioteca",
            icon: LucideLibrary,
            path: "/library"
        },
        {
            name: "Instancias",
            icon: LucideServer,
            path: "/my-instances"
        },
        {
            name: "Cuentas",
            icon: LucideUsers,
            path: "/mc-accounts"
        }
    ];


    return (
        <aside className="bg-ms-secondary h-full flex flex-col items-center py-4 space-y-2" style={{ gridArea: 'sidebar' }}>
            {NAV_ITEMS.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                    <div
                        key={item.name}
                        className={`group flex size-10 items-center justify-center p-2.5 rounded-md transition-all duration-200 ease-in-out cursor-pointer ${isActive ? "bg-neutral-800 text-white" : "text-ms-text hover:bg-neutral-700 hover:text-white"
                            }`}
                        onClick={() => navigate(item.path)}
                    >
                        <item.icon className="h-5 w-5 transition-transform duration-200 group-hover:scale-110" />
                    </div>
                );
            })}
        </aside>
    );
};