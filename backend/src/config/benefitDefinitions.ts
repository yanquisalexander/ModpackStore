export interface BenefitDefinition {
    id: string;
    name: string;
    description: string;
    type: 'boolean' | 'number' | 'string';
    defaultValue: any;
}

export const BENEFIT_DEFINITIONS: BenefitDefinition[] = [
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
    }
];

export function getBenefitDefinition(id: string) {
    return BENEFIT_DEFINITIONS.find(b => b.id === id);
}

export function getDefaultBenefits(): Record<string, any> {
    const defaults: Record<string, any> = {};
    BENEFIT_DEFINITIONS.forEach(b => {
        defaults[b.id] = b.defaultValue;
    });
    return defaults;
}
