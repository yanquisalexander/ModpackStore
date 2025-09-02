import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { RotateCcw } from 'lucide-react';

interface ConfigDefinition {
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

interface ConfigSectionProps {
    title: string;
    description?: string;
    configs: [string, ConfigDefinition][];
    values: Record<string, any>;
    onConfigChange: (key: string, value: any) => void;
    onRestoreDefaults: () => void;
    renderConfigControl: (key: string, def: ConfigDefinition) => React.ReactNode;
}

export const ConfigSection: React.FC<ConfigSectionProps> = ({
    title,
    description,
    configs,
    values,
    onConfigChange,
    onRestoreDefaults,
    renderConfigControl
}) => {
    const sectionTitle = title.charAt(0).toUpperCase() + title.slice(1);

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <CardTitle className="text-lg font-semibold">
                            {sectionTitle}
                        </CardTitle>
                        {description && (
                            <p className="text-sm text-muted-foreground">
                                {description}
                            </p>
                        )}
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onRestoreDefaults}
                        className="flex items-center gap-2"
                    >
                        <RotateCcw className="h-3 w-3" />
                        Restaurar valores por defecto
                    </Button>
                </div>
            </CardHeader>

            <CardContent className="space-y-6">
                {configs.length > 0 ? (
                    configs.map(([key, def], index, array) => (
                        <div key={key}>
                            {def.type === "boolean" ? (
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <Label className="text-sm font-medium">
                                            {def.description}
                                        </Label>
                                    </div>
                                    {renderConfigControl(key, def)}
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <Label htmlFor={key} className="text-sm font-medium">
                                        {def.description}
                                    </Label>
                                    {renderConfigControl(key, def)}
                                    {def.type === "slider" && (
                                        <p className="text-xs text-muted-foreground">
                                            Rango: {def.min} - {def.max}
                                        </p>
                                    )}
                                </div>
                            )}
                            {index < array.length - 1 && (
                                <Separator className="mt-4" />
                            )}
                        </div>
                    ))
                ) : (
                    <div className="h-32 flex items-center justify-center rounded-md border border-dashed border-muted bg-muted/50">
                        <p className="text-sm text-muted-foreground">
                            Más opciones estarán disponibles en futuras versiones
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};