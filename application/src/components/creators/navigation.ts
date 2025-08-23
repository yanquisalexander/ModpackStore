// config/navigation.ts
import {
    Home,
    Settings,
    Package,
    Users,
    LucideIcon,
    LucideHandCoins,
} from "lucide-react";

export interface NavItem {
    path: string;
    label: string;
    icon: LucideIcon;
}

export const getBaseNavItems = (): NavItem[] => [
    { path: "/creators", label: "Inicio", icon: Home },
    { path: "/creators/settings", label: "Configuración", icon: Settings },
];

export const getOrgNavItems = (orgId: string): NavItem[] => [
    { path: `/creators/org/${orgId}`, label: "Inicio", icon: Home },
    { path: `/creators/org/${orgId}/modpacks`, label: "Modpacks", icon: Package },
    { path: `/creators/org/${orgId}/members`, label: "Miembros", icon: Users },
    { path: `/creators/org/${orgId}/payments`, label: "Pagos", icon: LucideHandCoins },
    { path: `/creators/org/${orgId}/settings`, label: "Configuración", icon: Settings },
];