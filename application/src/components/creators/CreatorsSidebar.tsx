import React from "react";
import { Link, NavLink } from "react-router-dom";
import {
    LucidePencilRuler,
    Users,
    ArrowLeft,
    LucideIcon,
} from "lucide-react";

interface NavItem {
    path: string;
    label: string;
    icon: LucideIcon;
}

interface SidebarProps {
    isOrgRoute: boolean;
    orgId?: string;
    navItems: NavItem[];
    teams: any[];
}

export const CreatorsSidebar: React.FC<SidebarProps> = ({
    isOrgRoute,
    orgId,
    navItems,
    teams,
}) => {

    const currentTeam = teams.find(team => team.id === orgId);
    return (
        <aside className="fixed left-0 top-9 h-[calc(100vh-2.25rem)] w-64 bg-ms-primary shadow-lg flex flex-col border-r border-zinc-800">
            <div className="h-16 flex items-center justify-center border-b border-zinc-800">
                <h1 className="text-xl font-bold text-blue-500 flex items-center gap-2">
                    {isOrgRoute ? (
                        <>
                            <Users className="w-5 h-5 text-green-500" />
                            {currentTeam?.publisherName}
                        </>
                    ) : (
                        <>
                            <LucidePencilRuler className="w-5 h-5" />
                            Creators
                        </>
                    )}
                </h1>
            </div>

            <nav className="flex-1 px-4 py-6 flex-col space-y-1 overflow-y-auto">
                {isOrgRoute && (
                    <Link to="/creators" className="block mb-4">
                        <span className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-400 hover:bg-zinc-700/50 hover:text-gray-200 transition border border-zinc-700">
                            <ArrowLeft className="w-5 h-5" />
                            Todos los paneles
                        </span>
                    </Link>
                )}

                {navItems.map((item) => (
                    <NavLink key={item.path} to={item.path} end>
                        {({ isActive }) => (
                            <span className={`flex items-center gap-3 px-3 py-2 rounded-lg transition my-1.5 ${isActive ? 'bg-blue-500/20 text-blue-500' : 'text-gray-300 hover:bg-blue-500/20 hover:text-blue-400'}`}>
                                <item.icon className="w-5 h-5" />
                                {item.label}
                            </span>
                        )}
                    </NavLink>
                ))}

                {!isOrgRoute && teams.length > 0 && (
                    <>
                        <div className="pt-4 mt-4 border-t border-zinc-700">
                            <h3 className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                                Panel de Publisher
                            </h3>
                            <div className="space-y-1">
                                {teams.map((team) => (
                                    <Link key={`publisher-${team.id}`} to={`/publisher/${team.id}/modpacks`}>
                                        <span className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-300 hover:bg-zinc-700/50 hover:text-gray-200 transition">
                                            <Users className="w-5 h-5 text-blue-500/80" />
                                            <span className="truncate">{team.publisherName} (Nuevo)</span>
                                        </span>
                                    </Link>
                                ))}
                            </div>
                        </div>
                        <div className="pt-4 mt-4 border-t border-zinc-700">
                            <h3 className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                                Organizaciones (Estilo Antiguo)
                            </h3>
                            <div className="space-y-1">
                                {teams.map((team) => (
                                    <Link key={team.id} to={`/creators/org/${team.id}`}>
                                        <span className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-300 hover:bg-zinc-700/50 hover:text-gray-200 transition">
                                            <Users className="w-5 h-5 text-green-500/80" />
                                            <span className="truncate">{team.publisherName}</span>
                                        </span>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </nav>
        </aside>
    );
};