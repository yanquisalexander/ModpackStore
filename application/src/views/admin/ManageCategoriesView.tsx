import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
    Dialog, 
    DialogContent, 
    DialogDescription, 
    DialogFooter, 
    DialogHeader, 
    DialogTitle 
} from '@/components/ui/dialog';
import { 
    Table, 
    TableBody, 
    TableCell, 
    TableHead, 
    TableHeader, 
    TableRow 
} from '@/components/ui/table';
import { 
    AlertDialog, 
    AlertDialogAction, 
    AlertDialogCancel, 
    AlertDialogContent, 
    AlertDialogDescription, 
    AlertDialogFooter, 
    AlertDialogHeader, 
    AlertDialogTitle 
} from '@/components/ui/alert-dialog';
import {
    LucideTag,
    LucidePlus,
    LucideEdit,
    LucideTrash2,
    LucideMove,
    LucideSettings,
    LucideShield,
    LucideEye,
    LucideBot,
    LucideLoader
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthentication } from '@/stores/AuthContext';
import { 
    AdminCategoryService, 
    CategoryData, 
    CreateCategoryData, 
    UpdateCategoryData 
} from '@/services/categories';

interface CategoryFormData {
    name: string;
    shortDescription: string;
    description: string;
    iconUrl: string;
    displayOrder: number;
    isAdminOnly: boolean;
    isSelectable: boolean;
    isAutomatic: boolean;
}

const initialFormData: CategoryFormData = {
    name: '',
    shortDescription: '',
    description: '',
    iconUrl: '',
    displayOrder: 0,
    isAdminOnly: false,
    isSelectable: true,
    isAutomatic: false
};

export const ManageCategoriesView: React.FC = () => {
    const { sessionTokens } = useAuthentication();
    const [categories, setCategories] = useState<CategoryData[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    
    // Dialog states
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    
    // Form states
    const [formData, setFormData] = useState<CategoryFormData>(initialFormData);
    const [editingCategory, setEditingCategory] = useState<CategoryData | null>(null);
    const [deletingCategory, setDeletingCategory] = useState<CategoryData | null>(null);
    
    // Filter state
    const [showAdminOnly, setShowAdminOnly] = useState(true);
    const [showAutomatic, setShowAutomatic] = useState(true);

    // Load categories
    const loadCategories = async () => {
        try {
            if (!sessionTokens?.accessToken) return;
            
            setLoading(true);
            const response = await AdminCategoryService.getAllCategories(
                sessionTokens.accessToken,
                {
                    includeAdminOnly: showAdminOnly,
                    includeAutomatic: showAutomatic
                }
            );
            
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

    useEffect(() => {
        loadCategories();
    }, [sessionTokens, showAdminOnly, showAutomatic]);

    // Initialize default categories
    const initializeDefaultCategories = async () => {
        try {
            if (!sessionTokens?.accessToken) return;
            
            setSubmitting(true);
            const response = await AdminCategoryService.initializeDefaultCategories(sessionTokens.accessToken);
            
            if (response.success) {
                toast.success('Categorías por defecto inicializadas');
                await loadCategories();
            }
        } catch (error) {
            console.error('Error initializing categories:', error);
            toast.error('Error al inicializar categorías por defecto');
        } finally {
            setSubmitting(false);
        }
    };

    // Handle form changes
    const handleFormChange = (field: keyof CategoryFormData, value: any) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    // Handle create category
    const handleCreateCategory = async () => {
        try {
            if (!sessionTokens?.accessToken) return;
            
            setSubmitting(true);
            const createData: CreateCategoryData = {
                name: formData.name,
                shortDescription: formData.shortDescription || undefined,
                description: formData.description || undefined,
                iconUrl: formData.iconUrl || undefined,
                displayOrder: formData.displayOrder,
                isAdminOnly: formData.isAdminOnly,
                isSelectable: formData.isSelectable,
                isAutomatic: formData.isAutomatic
            };

            const response = await AdminCategoryService.createCategory(sessionTokens.accessToken, createData);
            
            if (response.success) {
                toast.success('Categoría creada exitosamente');
                setCreateDialogOpen(false);
                setFormData(initialFormData);
                await loadCategories();
            }
        } catch (error) {
            console.error('Error creating category:', error);
            toast.error(error instanceof Error ? error.message : 'Error al crear la categoría');
        } finally {
            setSubmitting(false);
        }
    };

    // Handle edit category
    const handleEditCategory = async () => {
        try {
            if (!sessionTokens?.accessToken || !editingCategory) return;
            
            setSubmitting(true);
            const updateData: UpdateCategoryData = {
                name: formData.name,
                shortDescription: formData.shortDescription || undefined,
                description: formData.description || undefined,
                iconUrl: formData.iconUrl || undefined,
                displayOrder: formData.displayOrder,
                isAdminOnly: formData.isAdminOnly,
                isSelectable: formData.isSelectable,
                isAutomatic: formData.isAutomatic
            };

            const response = await AdminCategoryService.updateCategory(
                sessionTokens.accessToken, 
                editingCategory.id, 
                updateData
            );
            
            if (response.success) {
                toast.success('Categoría actualizada exitosamente');
                setEditDialogOpen(false);
                setEditingCategory(null);
                setFormData(initialFormData);
                await loadCategories();
            }
        } catch (error) {
            console.error('Error updating category:', error);
            toast.error(error instanceof Error ? error.message : 'Error al actualizar la categoría');
        } finally {
            setSubmitting(false);
        }
    };

    // Handle delete category
    const handleDeleteCategory = async () => {
        try {
            if (!sessionTokens?.accessToken || !deletingCategory) return;
            
            setSubmitting(true);
            const response = await AdminCategoryService.deleteCategory(
                sessionTokens.accessToken, 
                deletingCategory.id
            );
            
            if (response.success) {
                toast.success('Categoría eliminada exitosamente');
                setDeleteDialogOpen(false);
                setDeletingCategory(null);
                await loadCategories();
            }
        } catch (error) {
            console.error('Error deleting category:', error);
            toast.error(error instanceof Error ? error.message : 'Error al eliminar la categoría');
        } finally {
            setSubmitting(false);
        }
    };

    // Open edit dialog
    const openEditDialog = (category: CategoryData) => {
        setEditingCategory(category);
        setFormData({
            name: category.name,
            shortDescription: category.shortDescription || '',
            description: category.description || '',
            iconUrl: category.iconUrl || '',
            displayOrder: category.displayOrder,
            isAdminOnly: category.isAdminOnly,
            isSelectable: category.isSelectable,
            isAutomatic: category.isAutomatic
        });
        setEditDialogOpen(true);
    };

    // Open delete dialog
    const openDeleteDialog = (category: CategoryData) => {
        setDeletingCategory(category);
        setDeleteDialogOpen(true);
    };

    // Get category type badges
    const getCategoryBadges = (category: CategoryData) => {
        const badges = [];
        
        if (category.isAutomatic) {
            badges.push(
                <Badge key="automatic" variant="secondary" className="text-xs">
                    <LucideBot className="w-3 h-3 mr-1" />
                    Automática
                </Badge>
            );
        }
        
        if (category.isAdminOnly) {
            badges.push(
                <Badge key="admin" variant="destructive" className="text-xs">
                    <LucideShield className="w-3 h-3 mr-1" />
                    Solo Admin
                </Badge>
            );
        }
        
        if (!category.isSelectable) {
            badges.push(
                <Badge key="not-selectable" variant="outline" className="text-xs">
                    <LucideEye className="w-3 h-3 mr-1" />
                    No Seleccionable
                </Badge>
            );
        }
        
        return badges;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <LucideLoader className="w-6 h-6 animate-spin mr-2" />
                <span>Cargando categorías...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <LucideTag className="h-6 w-6 text-primary" />
                            <div>
                                <CardTitle>Gestión de Categorías</CardTitle>
                                <p className="text-sm text-muted-foreground">
                                    Administrar categorías de modpacks y su organización
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                onClick={initializeDefaultCategories}
                                disabled={submitting}
                            >
                                <LucideSettings className="w-4 h-4 mr-2" />
                                Inicializar Por Defecto
                            </Button>
                            <Button
                                onClick={() => setCreateDialogOpen(true)}
                                disabled={submitting}
                            >
                                <LucidePlus className="w-4 h-4 mr-2" />
                                Nueva Categoría
                            </Button>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            {/* Filters */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center space-x-2">
                            <Switch
                                id="show-admin"
                                checked={showAdminOnly}
                                onCheckedChange={setShowAdminOnly}
                            />
                            <Label htmlFor="show-admin">Mostrar categorías de admin</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Switch
                                id="show-automatic"
                                checked={showAutomatic}
                                onCheckedChange={setShowAutomatic}
                            />
                            <Label htmlFor="show-automatic">Mostrar categorías automáticas</Label>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Categories Table */}
            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Orden</TableHead>
                                <TableHead>Nombre</TableHead>
                                <TableHead>Descripción</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead>Creada</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {categories.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                        No hay categorías disponibles
                                    </TableCell>
                                </TableRow>
                            ) : (
                                categories.map((category) => (
                                    <TableRow key={category.id}>
                                        <TableCell className="font-mono text-sm">
                                            {category.displayOrder}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                {category.iconUrl && (
                                                    <img 
                                                        src={category.iconUrl} 
                                                        alt={category.name}
                                                        className="w-5 h-5 rounded"
                                                    />
                                                )}
                                                <span className="font-medium">{category.name}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div>
                                                {category.shortDescription && (
                                                    <div className="text-sm">{category.shortDescription}</div>
                                                )}
                                                {category.description && (
                                                    <div className="text-xs text-muted-foreground mt-1">
                                                        {category.description}
                                                    </div>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap gap-1">
                                                {getCategoryBadges(category)}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {new Date(category.createdAt).toLocaleDateString()}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => openEditDialog(category)}
                                                    disabled={submitting}
                                                >
                                                    <LucideEdit className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => openDeleteDialog(category)}
                                                    disabled={submitting || category.isAutomatic}
                                                >
                                                    <LucideTrash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Create Category Dialog */}
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Crear Nueva Categoría</DialogTitle>
                        <DialogDescription>
                            Crear una nueva categoría para organizar los modpacks
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="name">Nombre *</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => handleFormChange('name', e.target.value)}
                                placeholder="Nombre de la categoría"
                            />
                        </div>
                        
                        <div>
                            <Label htmlFor="shortDescription">Descripción Corta</Label>
                            <Input
                                id="shortDescription"
                                value={formData.shortDescription}
                                onChange={(e) => handleFormChange('shortDescription', e.target.value)}
                                placeholder="Descripción breve (opcional)"
                            />
                        </div>
                        
                        <div>
                            <Label htmlFor="description">Descripción</Label>
                            <Textarea
                                id="description"
                                value={formData.description}
                                onChange={(e) => handleFormChange('description', e.target.value)}
                                placeholder="Descripción detallada (opcional)"
                                rows={3}
                            />
                        </div>
                        
                        <div>
                            <Label htmlFor="iconUrl">URL del Ícono</Label>
                            <Input
                                id="iconUrl"
                                value={formData.iconUrl}
                                onChange={(e) => handleFormChange('iconUrl', e.target.value)}
                                placeholder="https://ejemplo.com/icono.png (opcional)"
                            />
                        </div>
                        
                        <div>
                            <Label htmlFor="displayOrder">Orden de Visualización</Label>
                            <Input
                                id="displayOrder"
                                type="number"
                                value={formData.displayOrder}
                                onChange={(e) => handleFormChange('displayOrder', parseInt(e.target.value) || 0)}
                                placeholder="0"
                            />
                        </div>

                        <Separator />

                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="isAdminOnly">Solo para Administradores</Label>
                                <Switch
                                    id="isAdminOnly"
                                    checked={formData.isAdminOnly}
                                    onCheckedChange={(checked) => handleFormChange('isAdminOnly', checked)}
                                />
                            </div>
                            
                            <div className="flex items-center justify-between">
                                <Label htmlFor="isSelectable">Seleccionable por Publishers</Label>
                                <Switch
                                    id="isSelectable"
                                    checked={formData.isSelectable}
                                    onCheckedChange={(checked) => handleFormChange('isSelectable', checked)}
                                />
                            </div>
                            
                            <div className="flex items-center justify-between">
                                <Label htmlFor="isAutomatic">Categoría Automática</Label>
                                <Switch
                                    id="isAutomatic"
                                    checked={formData.isAutomatic}
                                    onCheckedChange={(checked) => handleFormChange('isAutomatic', checked)}
                                />
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setCreateDialogOpen(false)}
                            disabled={submitting}
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleCreateCategory}
                            disabled={submitting || !formData.name}
                        >
                            {submitting && <LucideLoader className="w-4 h-4 mr-2 animate-spin" />}
                            Crear Categoría
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Category Dialog */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Editar Categoría</DialogTitle>
                        <DialogDescription>
                            Modificar la configuración de la categoría
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="edit-name">Nombre *</Label>
                            <Input
                                id="edit-name"
                                value={formData.name}
                                onChange={(e) => handleFormChange('name', e.target.value)}
                                placeholder="Nombre de la categoría"
                            />
                        </div>
                        
                        <div>
                            <Label htmlFor="edit-shortDescription">Descripción Corta</Label>
                            <Input
                                id="edit-shortDescription"
                                value={formData.shortDescription}
                                onChange={(e) => handleFormChange('shortDescription', e.target.value)}
                                placeholder="Descripción breve (opcional)"
                            />
                        </div>
                        
                        <div>
                            <Label htmlFor="edit-description">Descripción</Label>
                            <Textarea
                                id="edit-description"
                                value={formData.description}
                                onChange={(e) => handleFormChange('description', e.target.value)}
                                placeholder="Descripción detallada (opcional)"
                                rows={3}
                            />
                        </div>
                        
                        <div>
                            <Label htmlFor="edit-iconUrl">URL del Ícono</Label>
                            <Input
                                id="edit-iconUrl"
                                value={formData.iconUrl}
                                onChange={(e) => handleFormChange('iconUrl', e.target.value)}
                                placeholder="https://ejemplo.com/icono.png (opcional)"
                            />
                        </div>
                        
                        <div>
                            <Label htmlFor="edit-displayOrder">Orden de Visualización</Label>
                            <Input
                                id="edit-displayOrder"
                                type="number"
                                value={formData.displayOrder}
                                onChange={(e) => handleFormChange('displayOrder', parseInt(e.target.value) || 0)}
                                placeholder="0"
                            />
                        </div>

                        <Separator />

                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="edit-isAdminOnly">Solo para Administradores</Label>
                                <Switch
                                    id="edit-isAdminOnly"
                                    checked={formData.isAdminOnly}
                                    onCheckedChange={(checked) => handleFormChange('isAdminOnly', checked)}
                                />
                            </div>
                            
                            <div className="flex items-center justify-between">
                                <Label htmlFor="edit-isSelectable">Seleccionable por Publishers</Label>
                                <Switch
                                    id="edit-isSelectable"
                                    checked={formData.isSelectable}
                                    onCheckedChange={(checked) => handleFormChange('isSelectable', checked)}
                                />
                            </div>
                            
                            <div className="flex items-center justify-between">
                                <Label htmlFor="edit-isAutomatic">Categoría Automática</Label>
                                <Switch
                                    id="edit-isAutomatic"
                                    checked={formData.isAutomatic}
                                    onCheckedChange={(checked) => handleFormChange('isAutomatic', checked)}
                                />
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setEditDialogOpen(false)}
                            disabled={submitting}
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleEditCategory}
                            disabled={submitting || !formData.name}
                        >
                            {submitting && <LucideLoader className="w-4 h-4 mr-2 animate-spin" />}
                            Guardar Cambios
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Category Dialog */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar categoría?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción no se puede deshacer. La categoría "{deletingCategory?.name}" 
                            será eliminada permanentemente. Asegúrate de que no esté asignada a ningún modpack.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={submitting}>
                            Cancelar
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteCategory}
                            disabled={submitting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {submitting && <LucideLoader className="w-4 h-4 mr-2 animate-spin" />}
                            Eliminar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};