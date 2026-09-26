import React from "react";
import { Link, NavLink } from "react-router-dom";
import {
    LucidePencilRuler,
    LucideBuilding2,
    LucideArrowLeft,
    LucideChevronRight,
    LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

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
        <aside className="flex flex-col h-full gap-4">
            {/* Header */}
            <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-primary/10 text-primary shrink-0">
                    {isOrgRoute ? (
                        <LucideBuilding2 className="h-4 w-4" />
                    ) : (
                        <LucidePencilRuler className="h-4 w-4" />
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <h2 className="font-semibold text-sm truncate text-foreground">
                        {isOrgRoute
                            ? (currentTeam?.displayName || currentTeam?.publisherName || "Equipo")
                            : "Panel de Creadores"
                        }
                    </h2>
                </div>
                <Badge variant="secondary" className="text-[10px] shrink-0 px-1.5">
                    CREATOR
                </Badge>
            </div>

            <Separator />

            {/* Back link for org routes */}
            {isOrgRoute && (
                <Link
                    to="/creators"
                    className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors p-2 rounded-lg hover:bg-muted/40 border border-border/50"
                >
                    <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
                    <span>Volver a todos los paneles</span>
                </Link>
            )}

            {/* Nav items */}
            <nav className="space-y-1">
                {navItems.map((item) => (
                    <NavLink key={item.path} to={item.path} end>
                        {({ isActive }) => (
                            <span className={cn(
                                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                                isActive
                                    ? "bg-primary text-primary-foreground"
                                    : "text-foreground hover:bg-muted/50"
                            )}>
                                <item.icon className="h-4 w-4 shrink-0" />
                                <span className="flex-1">{item.label}</span>
                                {isActive && <LucideChevronRight className="h-3.5 w-3.5 shrink-0 opacity-70" />}
                            </span>
                        )}
                    </NavLink>
                ))}
            </nav>

            {/* Teams list (only on non-org routes) */}
            {!isOrgRoute && teams.length > 0 && (
                <div className="pt-2 border-t border-border space-y-2">
                    <h3 className="px-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Tus Organizaciones ({teams.length})
                    </h3>
                    <div className="space-y-1">
                        {teams.map((team) => (
                            <Link key={team.id} to={`/creators/org/${team.id}`}>
                                <span className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-foreground hover:bg-muted/50 transition-colors">
                                    <div className="size-6 rounded-md bg-muted/60 border border-border/60 flex items-center justify-center shrink-0 overflow-hidden">
                                        {team.logoUrl ? (
                                            <img src={team.logoUrl} alt="" className="size-full object-cover" />
                                        ) : (
                                            <LucideBuilding2 className="h-3.5 w-3.5 text-muted-foreground" />
                                        )}
                                    </div>
                                    <span className="truncate flex-1">{team.displayName || team.publisherName}</span>
                                    <LucideChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                                </span>
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            {/* Switch team (only on org routes) */}
            {isOrgRoute && (
                <div className="mt-auto pt-4 border-t border-border">
                    <Link
                        to="/creators"
                        className="flex items-center justify-between p-2.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors border border-dashed border-border"
                    >
                        <div className="flex items-center gap-2">
                            <LucideBuilding2 className="h-3.5 w-3.5" />
                            <span>Cambiar de equipo</span>
                        </div>
                        <LucideChevronRight className="h-3 w-3" />
                    </Link>
                </div>
            )}
        </aside>
    );
};

// re-export for convenience — used in some older paths
const ArrowLeft = LucideArrowLeft;
