import {
    LayoutDashboard,
    Package,
    Users,
    BarChart3,
    Cloud,
    Settings,
    type LucideIcon,
} from "lucide-react";

export interface NavItem {
    path: string;
    label: string;
    icon: LucideIcon;
}

export const getBaseNavItems = (): NavItem[] => [
    { path: "/creators", label: "Dashboard", icon: LayoutDashboard },
    { path: "/creators/settings", label: "Configuración", icon: Settings },
];

export const getOrgNavItems = (orgId: string): NavItem[] => [
    { path: `/creators/org/${orgId}`, label: "Dashboard", icon: LayoutDashboard },
    { path: `/creators/org/${orgId}/modpacks`, label: "Modpacks", icon: Package },
    { path: `/creators/org/${orgId}/team`, label: "Equipo", icon: Users },
    { path: `/creators/org/${orgId}/analytics`, label: "Métricas", icon: BarChart3 },
    { path: `/creators/org/${orgId}/storage`, label: "Archivos", icon: Cloud },
    { path: `/creators/org/${orgId}/settings`, label: "Ajustes", icon: Settings },
];
