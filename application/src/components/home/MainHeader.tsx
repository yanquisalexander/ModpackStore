import { LucideLayoutGrid, LucideServer, LucideUsers, LucideWrench } from "lucide-react"
import { Link, useLocation, useNavigate } from "react-router-dom";

interface NavigationSection {
    path: string;
    title: string;
    icon: React.ComponentType<{ className?: string }>;
}

export const HomeMainHeader = () => {
    const location = useLocation();

    const SECTIONS: NavigationSection[] = [
        {
            path: "/",
            title: "Explorar",
            icon: LucideLayoutGrid
        },
        {
            path: "/my-instances",
            title: "Mis Instancias",
            icon: LucideServer
        },
        {
            path: "/mc-accounts",
            title: "Cuentas",
            icon: LucideUsers
        }
    ];

    const SHOULD_SHOW_HEADER = SECTIONS.some((section) => section.path === location.pathname);

    if (!SHOULD_SHOW_HEADER) {
        return null;
    }

    return (
        <header className="sticky top-0 z-50 h-16 w-full bg-ms-primary text-white select-none  backdrop-blur-sm">
            <nav className="flex h-full items-center justify-between px-4 lg:px-6">
                <div className="flex items-center gap-x-1">
                    {SECTIONS.map((section) => {
                        const isActive = location.pathname === section.path;
                        return (
                            <Link
                                to={section.path}
                                key={section.path}
                                aria-current={isActive ? "page" : undefined}
                                className={`
                                    group relative flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium
                                    transition-all duration-200 ease-in-out
                                    hover:bg-white/10 
                                    navbar-${section.title.toLowerCase().replace(/\s+/g, '-')}
                                    focus:outline-none 
                                    ${isActive
                                        ? "bg-white text-black shadow-lg"
                                        : "text-white hover:text-white"
                                    }
                                `}
                            >
                                <section.icon className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
                                <span className="hidden sm:inline">{section.title}</span>
                                <span className="sm:hidden">{section.title.split(' ')[0]}</span>


                            </Link>
                        );
                    })}
                </div>

                {/* Future: Add user menu or additional actions here */}
                <div className="flex items-center gap-2">
                    {/* Placeholder for future features */}
                </div>
            </nav>
        </header>
    );
};