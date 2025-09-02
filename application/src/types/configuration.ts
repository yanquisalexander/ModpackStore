// Configuration types for the Configuration dialog and sections

export interface ConfigDefinition {
    type: 'string' | 'integer' | 'float' | 'boolean' | 'path' | 'enum' | 'slider';
    default: any;
    description: string;
    ui_section: string;
    client?: boolean;
    min?: number;
    max?: number;
    step?: number;
    choices?: any[];
    validator?: string;
}

export interface ConfigSchema {
    [key: string]: ConfigDefinition;
}

export interface ConfigState {
    values: Record<string, any>;
    schema: ConfigSchema;
    sections: string[];
    loading: boolean;
    saving: boolean;
    gitHash: string;
}

export interface ConfigurationDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

export interface ConfigSectionProps {
    title: string;
    description?: string;
    configs: [string, ConfigDefinition][];
    values: Record<string, any>;
    onConfigChange: (key: string, value: any) => void;
    onRestoreDefaults: () => void;
    renderConfigControl: (key: string, def: ConfigDefinition) => React.ReactNode;
}