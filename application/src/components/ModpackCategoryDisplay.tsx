import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { LucideStar, LucideShield } from 'lucide-react';
import { ModpackCategory } from '@/types/modpacks';

interface ModpackCategoryDisplayProps {
    categories: ModpackCategory[];
    className?: string;
}

export const ModpackCategoryDisplay: React.FC<ModpackCategoryDisplayProps> = ({
    categories,
    className
}) => {
    if (!categories || categories.length === 0) {
        return (
            <div className={className}>
                <Label className="text-sm text-muted-foreground">Sin categorías asignadas</Label>
            </div>
        );
    }

    // Separate categories by type
    const publisherCategories = categories.filter(mc => !mc.category.isAdminOnly);
    const adminCategories = categories.filter(mc => mc.category.isAdminOnly);

    return (
        <div className={className}>
            <Label className="text-sm">Categorías del Modpack</Label>
            
            <div className="space-y-3 mt-2">
                {/* Publisher Categories */}
                {publisherCategories.length > 0 && (
                    <div>
                        <Label className="text-xs text-muted-foreground">Seleccionadas por el Publisher</Label>
                        <div className="flex flex-wrap gap-2 mt-1">
                            {publisherCategories.map((modpackCategory) => {
                                const isPrimary = modpackCategory.isPrimary;
                                const category = modpackCategory.category;
                                
                                return (
                                    <Badge
                                        key={modpackCategory.id}
                                        variant={isPrimary ? "default" : "secondary"}
                                        className="flex items-center gap-2"
                                    >
                                        <div className="flex items-center gap-1">
                                            {category.iconUrl && (
                                                <img 
                                                    src={category.iconUrl} 
                                                    alt={category.name}
                                                    className="w-3 h-3 rounded"
                                                />
                                            )}
                                            <span>{category.name}</span>
                                            {isPrimary && (
                                                <LucideStar className="h-3 w-3" />
                                            )}
                                        </div>
                                    </Badge>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Admin Categories */}
                {adminCategories.length > 0 && (
                    <div>
                        <Label className="text-xs text-muted-foreground">Asignadas por Administración</Label>
                        <div className="flex flex-wrap gap-2 mt-1">
                            {adminCategories.map((modpackCategory) => {
                                const category = modpackCategory.category;
                                
                                return (
                                    <Badge
                                        key={modpackCategory.id}
                                        variant="outline"
                                        className="flex items-center gap-2 border-amber-500 text-amber-600"
                                    >
                                        <div className="flex items-center gap-1">
                                            <LucideShield className="h-3 w-3" />
                                            {category.iconUrl && (
                                                <img 
                                                    src={category.iconUrl} 
                                                    alt={category.name}
                                                    className="w-3 h-3 rounded"
                                                />
                                            )}
                                            <span>{category.name}</span>
                                        </div>
                                    </Badge>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};