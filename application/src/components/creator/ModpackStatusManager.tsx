import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { LucideEye, LucideEyeOff, LucideArchive, LucideFileText, LucideCheck } from 'lucide-react';

interface ModpackStatusManagerProps {
    currentStatus: 'draft' | 'published' | 'archived' | 'deleted';
    onStatusChange: (newStatus: 'draft' | 'published' | 'archived') => void;
    disabled?: boolean;
    hasPrimaryCategory?: boolean;
    className?: string;
}

const statusConfig = {
    draft: {
        label: 'Borrador',
        icon: LucideFileText,
        color: 'bg-gray-500',
        description: 'El modpack está en desarrollo y no es visible públicamente'
    },
    published: {
        label: 'Publicado',
        icon: LucideEye,
        color: 'bg-green-500',
        description: 'El modpack es visible públicamente y puede ser descargado'
    },
    archived: {
        label: 'Archivado',
        icon: LucideArchive,
        color: 'bg-yellow-500',
        description: 'El modpack está archivado y no es visible públicamente'
    },
    deleted: {
        label: 'Eliminado',
        icon: LucideEyeOff,
        color: 'bg-red-500',
        description: 'El modpack ha sido eliminado (no se puede cambiar)'
    }
};

export const ModpackStatusManager: React.FC<ModpackStatusManagerProps> = ({
    currentStatus,
    onStatusChange,
    disabled = false,
    hasPrimaryCategory = false,
    className
}) => {
    const currentConfig = statusConfig[currentStatus];
    const IconComponent = currentConfig.icon;

    const canPublish = hasPrimaryCategory;
    const isDeleted = currentStatus === 'deleted';

    return (
        <div className={className}>
            <div className="space-y-3">
                <Label>Estado del Modpack</Label>
                
                {/* Current Status Display */}
                <div className="flex items-center gap-3">
                    <Badge className={`${currentConfig.color} text-white flex items-center gap-2`}>
                        <IconComponent className="h-3 w-3" />
                        {currentConfig.label}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                        {currentConfig.description}
                    </span>
                </div>

                {/* Status Change Controls */}
                {!isDeleted && (
                    <div className="space-y-3">
                        <Label className="text-sm">Cambiar Estado</Label>
                        
                        <Select 
                            value={currentStatus} 
                            onValueChange={onStatusChange}
                            disabled={disabled}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="draft">
                                    <div className="flex items-center gap-2">
                                        <LucideFileText className="h-4 w-4" />
                                        Borrador
                                    </div>
                                </SelectItem>
                                <SelectItem 
                                    value="published" 
                                    disabled={!canPublish}
                                >
                                    <div className="flex items-center gap-2">
                                        <LucideEye className="h-4 w-4" />
                                        Publicado
                                        {!canPublish && (
                                            <span className="text-xs text-red-400 ml-2">
                                                (Requiere categoría primaria)
                                            </span>
                                        )}
                                    </div>
                                </SelectItem>
                                <SelectItem value="archived">
                                    <div className="flex items-center gap-2">
                                        <LucideArchive className="h-4 w-4" />
                                        Archivado
                                    </div>
                                </SelectItem>
                            </SelectContent>
                        </Select>

                        {/* Validation Messages */}
                        {currentStatus === 'draft' && !canPublish && (
                            <div className="text-sm text-yellow-600 bg-yellow-50 border border-yellow-200 rounded p-2">
                                <LucideCheck className="h-4 w-4 inline mr-2" />
                                Para publicar el modpack, debe tener al menos una categoría primaria asignada.
                            </div>
                        )}

                        {currentStatus === 'published' && (
                            <div className="text-sm text-green-600 bg-green-50 border border-green-200 rounded p-2">
                                <LucideCheck className="h-4 w-4 inline mr-2" />
                                El modpack está publicado y visible para todos los usuarios.
                            </div>
                        )}
                    </div>
                )}

                {isDeleted && (
                    <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
                        <LucideEyeOff className="h-4 w-4 inline mr-2" />
                        Este modpack ha sido eliminado y no se puede modificar su estado.
                    </div>
                )}
            </div>
        </div>
    );
};