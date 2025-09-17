import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { 
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
} from '@/components/ui/command';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { 
    LucideCheck, 
    LucideChevronsUpDown, 
    LucideX, 
    LucideTag,
    LucideShield,
    LucideStar
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CategoryService, CategoryData } from '@/services/categories';
import { toast } from 'sonner';

interface CategorySelectorProps {
    selectedCategories: string[];
    primaryCategoryId?: string;
    onCategoriesChange: (categories: string[]) => void;
    onPrimaryCategoryChange: (categoryId: string) => void;
    className?: string;
    disabled?: boolean;
}

export const CategorySelector: React.FC<CategorySelectorProps> = ({
    selectedCategories,
    primaryCategoryId,
    onCategoriesChange,
    onPrimaryCategoryChange,
    className,
    disabled = false
}) => {
    const [categories, setCategories] = useState<CategoryData[]>([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);

    // Load available categories for publishers
    useEffect(() => {
        const loadCategories = async () => {
            try {
                setLoading(true);
                const response = await CategoryService.getCategoriesForPublishers();
                
                if (response.success) {
                    setCategories(response.data);
                }
            } catch (error) {
                console.error('Error loading categories:', error);
                toast.error('Error al cargar las categorías');
            } finally {
                setLoading(false);
            }
        };

        loadCategories();
    }, []);

    // Handle category selection
    const handleCategorySelect = (categoryId: string) => {
        const isSelected = selectedCategories.includes(categoryId);
        
        if (isSelected) {
            // Remove category
            const newCategories = selectedCategories.filter(id => id !== categoryId);
            onCategoriesChange(newCategories);
            
            // If removing primary category, select another as primary
            if (categoryId === primaryCategoryId && newCategories.length > 0) {
                onPrimaryCategoryChange(newCategories[0]);
            }
        } else {
            // Add category
            const newCategories = [...selectedCategories, categoryId];
            onCategoriesChange(newCategories);
            
            // If no primary category is set, make this the primary
            if (!primaryCategoryId) {
                onPrimaryCategoryChange(categoryId);
            }
        }
    };

    // Handle primary category change
    const handlePrimaryCategoryChange = (categoryId: string) => {
        if (selectedCategories.includes(categoryId)) {
            onPrimaryCategoryChange(categoryId);
        }
    };

    // Remove category
    const removeCategory = (categoryId: string) => {
        const newCategories = selectedCategories.filter(id => id !== categoryId);
        onCategoriesChange(newCategories);
        
        // If removing primary category, select another as primary
        if (categoryId === primaryCategoryId && newCategories.length > 0) {
            onPrimaryCategoryChange(newCategories[0]);
        }
    };

    // Get category by ID
    const getCategoryById = (id: string) => {
        return categories.find(cat => cat.id === id);
    };

    // Get selected category objects
    const selectedCategoryObjects = selectedCategories
        .map(id => getCategoryById(id))
        .filter(Boolean) as CategoryData[];

    if (loading) {
        return (
            <div className={cn("space-y-2", className)}>
                <Label>Categorías</Label>
                <div className="text-sm text-muted-foreground">
                    Cargando categorías disponibles...
                </div>
            </div>
        );
    }

    return (
        <div className={cn("space-y-4", className)}>
            <div className="space-y-2">
                <Label>Categorías</Label>
                <p className="text-sm text-muted-foreground">
                    Selecciona las categorías que mejor describan tu modpack. 
                    La primera será la categoría principal.
                </p>
            </div>

            {/* Category Selector */}
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-full justify-between"
                        disabled={disabled}
                    >
                        <div className="flex items-center gap-2">
                            <LucideTag className="h-4 w-4" />
                            <span>
                                {selectedCategories.length > 0 
                                    ? `${selectedCategories.length} categoría${selectedCategories.length > 1 ? 's' : ''} seleccionada${selectedCategories.length > 1 ? 's' : ''}`
                                    : "Seleccionar categorías"
                                }
                            </span>
                        </div>
                        <LucideChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                    <Command>
                        <CommandInput placeholder="Buscar categorías..." />
                        <CommandEmpty>No se encontraron categorías.</CommandEmpty>
                        <CommandGroup>
                            {categories.map((category) => {
                                const isSelected = selectedCategories.includes(category.id);
                                const isPrimary = category.id === primaryCategoryId;
                                
                                return (
                                    <CommandItem
                                        key={category.id}
                                        value={category.name}
                                        onSelect={() => handleCategorySelect(category.id)}
                                        className="flex items-center justify-between"
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className={cn(
                                                "flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                                isSelected
                                                    ? "bg-primary text-primary-foreground"
                                                    : "opacity-50"
                                            )}>
                                                {isSelected && <LucideCheck className="h-3 w-3" />}
                                            </div>
                                            
                                            <div className="flex items-center gap-2">
                                                {category.iconUrl && (
                                                    <img 
                                                        src={category.iconUrl} 
                                                        alt={category.name}
                                                        className="w-4 h-4 rounded"
                                                    />
                                                )}
                                                <span>{category.name}</span>
                                                {isPrimary && (
                                                    <LucideStar className="h-3 w-3 text-yellow-500" />
                                                )}
                                            </div>
                                        </div>
                                        
                                        {category.shortDescription && (
                                            <span className="text-xs text-muted-foreground max-w-[200px] truncate">
                                                {category.shortDescription}
                                            </span>
                                        )}
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>
                    </Command>
                </PopoverContent>
            </Popover>

            {/* Selected Categories */}
            {selectedCategoryObjects.length > 0 && (
                <div className="space-y-2">
                    <Label className="text-sm">Categorías Seleccionadas</Label>
                    <div className="flex flex-wrap gap-2">
                        {selectedCategoryObjects.map((category) => {
                            const isPrimary = category.id === primaryCategoryId;
                            
                            return (
                                <Badge
                                    key={category.id}
                                    variant={isPrimary ? "default" : "secondary"}
                                    className="flex items-center gap-2 pr-1"
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
                                    
                                    <div className="flex items-center gap-1">
                                        {!isPrimary && selectedCategories.length > 1 && (
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-auto p-0 w-4 h-4 hover:bg-transparent"
                                                onClick={() => handlePrimaryCategoryChange(category.id)}
                                                disabled={disabled}
                                                title="Hacer categoría principal"
                                            >
                                                <LucideStar className="h-3 w-3 opacity-50 hover:opacity-100" />
                                            </Button>
                                        )}
                                        
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-auto p-0 w-4 h-4 hover:bg-transparent"
                                            onClick={() => removeCategory(category.id)}
                                            disabled={disabled}
                                        >
                                            <LucideX className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </Badge>
                            );
                        })}
                    </div>
                    
                    {primaryCategoryId && (
                        <p className="text-xs text-muted-foreground">
                            <LucideStar className="h-3 w-3 inline mr-1" />
                            La categoría marcada con estrella es la categoría principal
                        </p>
                    )}
                </div>
            )}

            {/* Validation Message */}
            {selectedCategories.length === 0 && (
                <p className="text-xs text-destructive">
                    Debes seleccionar al menos una categoría para tu modpack
                </p>
            )}
        </div>
    );
};