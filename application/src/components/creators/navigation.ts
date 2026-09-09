import {
    LayoutDashboard,
    Package,
    Users,
    BarChart3,
    Cloud,
    Settings,
    Megaphone,
    type LucideIcon,
} from "lucide-react";

export interface NavItem {
    path: string;
    label: string;
    description: string;
    icon: LucideIcon;
}

export const getBaseNavItems = (): NavItem[] => [
    {
        path: "/creators",
        label: "Dashboard",
        description: "Resumen de creador y equipos",
        icon: LayoutDashboard,
    },
    {
        path: "/creators/settings",
        label: "Configuración",
        description: "Preferencias de la cuenta",
        icon: Settings,
    },
];

export const getOrgNavItems = (orgId: string): NavItem[] => [
    {
        path: `/creators/org/${orgId}`,
        label: "Dashboard",
        description: "Resumen y actividad reciente",
        icon: LayoutDashboard,
    },
    {
        path: `/creators/org/${orgId}/modpacks`,
        label: "Modpacks",
        description: "Proyectos y versiones",
        icon: Package,
    },
    {
        path: `/creators/org/${orgId}/team`,
        label: "Equipo",
        description: "Miembros y permisos",
        icon: Users,
    },
    {
        path: `/creators/org/${orgId}/analytics`,
        label: "Métricas",
        description: "Estadísticas y descargas",
        icon: BarChart3,
    },
    {
        path: `/creators/org/${orgId}/promotions`,
        label: "Patrocinios",
        description: "Campañas y anuncios",
        icon: Megaphone,
    },
    {
        path: `/creators/org/${orgId}/storage`,
        label: "Archivos",
        description: "Almacenamiento en la nube",
        icon: Cloud,
    },
    {
        path: `/creators/org/${orgId}/settings`,
        label: "Ajustes",
        description: "Perfil de la organización",
        icon: Settings,
    },
];
