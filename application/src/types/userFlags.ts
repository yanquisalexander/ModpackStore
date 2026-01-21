/**
 * User flags interface representing Modpack Store+ benefits
 * These flags are obtained from the backend and reflect the user's Patreon tier
 */
export interface UserFlags {
    max_instances_allowed: number;

    // Feature flags
    can_upload_cover_image: boolean;
    priority_support: boolean;
    early_access_features: boolean;
    custom_badges: boolean;
    server_priority_queue: boolean;
    custom_instance_icons: boolean;
    allow_mod_manager: boolean;
    enable_instance_mod_downloader: boolean;
}

/**
 * Definition of a benefit for administrative purposes
 */
export interface BenefitDefinition {
    id: keyof UserFlags;
    name: string;
    description: string;
    type: 'boolean' | 'number' | 'string';
    defaultValue: any;
}

/**
 * List of all available benefits in the system
 */
export const AVAILABLE_BENEFITS: BenefitDefinition[] = [
    {
        id: 'max_instances_allowed',
        name: 'Límite de Instancias',
        description: 'Número máximo de instancias que el usuario puede crear',
        type: 'number',
        defaultValue: 10
    },
    {
        id: 'can_upload_cover_image',
        name: 'Subir Imagen de Portada',
        description: 'Permite al usuario personalizar la portada de sus modpacks',
        type: 'boolean',
        defaultValue: false
    },
    {
        id: 'priority_support',
        name: 'Soporte Prioritario',
        description: 'Acceso a canales de soporte con respuesta rápida',
        type: 'boolean',
        defaultValue: false
    },
    {
        id: 'early_access_features',
        name: 'Acceso Anticipado',
        description: 'Probar nuevas funciones antes que nadie',
        type: 'boolean',
        defaultValue: false
    },
    {
        id: 'custom_badges',
        name: 'Insignias Personalizadas',
        description: 'Permite mostrar insignias especiales en el perfil',
        type: 'boolean',
        defaultValue: false
    },
    {
        id: 'server_priority_queue',
        name: 'Cola de Prioridad en Servidores',
        description: 'Saltar colas en servidores oficiales',
        type: 'boolean',
        defaultValue: false
    },
    {
        id: 'custom_instance_icons',
        name: 'Iconos de Instancia Personalizados',
        description: 'Permite cambiar los iconos de las instancias locales',
        type: 'boolean',
        defaultValue: false
    },
    {
        id: 'allow_mod_manager',
        name: 'Gestor de Mods Integrado',
        description: 'Permite gestionar mods directamente desde Modpack Store en instancias locales',
        type: 'boolean',
        defaultValue: false
    },
    {
        id: 'enable_instance_mod_downloader',
        name: 'Descargador de Mods',
        description: 'Permite descargar mods directamente desde Modrinth en instancias locales',
        type: 'boolean',
        defaultValue: false
    }
];

/**
 * Default flags for unauthenticated or free users
 */
export const DEFAULT_USER_FLAGS: UserFlags = {
    max_instances_allowed: 10,
    can_upload_cover_image: false,
    priority_support: false,
    early_access_features: false,
    custom_badges: false,
    server_priority_queue: false,
    custom_instance_icons: false,
    allow_mod_manager: false,
    enable_instance_mod_downloader: false,
};
