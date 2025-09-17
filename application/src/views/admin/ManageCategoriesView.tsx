import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import {
    LucideLoader,
    LucideTrash,
    LucideEdit,
    LucidePlus,
    LucideSearch,
    LucideRefreshCw,
    LucideTag,
    LucideEye,
    LucideEyeOff
} from 'lucide-react';
import { useAuthentication } from '@/stores/AuthContext';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { API_ENDPOINT } from "@/consts";

// Types
interface Category {
    id: string;
    name: string;
    shortDescription?: string;
    description?: string;
    iconUrl?: string;
    isPrimaryAllowed: boolean;
    isPublisherSelectable: boolean;
    sortOrder: number;
    createdAt: string;
}

interface PaginatedCategories {
    data: Category[];
    meta?: {
        total: number;
        page: number;
        limit: number;
    };
}

interface CategoryFormData {
    name: string;
    shortDescription: string;
    description: string;
    iconUrl: string;
    isPrimaryAllowed: boolean;
    isPublisherSelectable: boolean;
    sortOrder: number;
}

// API Service
class AdminCategoriesAPI {
    private static async makeRequest(endpoint: string, options?: RequestInit) {
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('No authentication token found');
        }

        const response = await fetch(`${API_ENDPOINT}/admin/categories${endpoint}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                ...options?.headers,
            },
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
        }

        return response.json();
    }

    static async getCategories(): Promise<PaginatedCategories> {
        return this.makeRequest('');
    }

    static async createCategory(categoryData: CategoryFormData): Promise<Category> {
        return this.makeRequest('', {
            method: 'POST',
            body: JSON.stringify(categoryData),
        });
    }

    static async updateCategory(categoryId: string, categoryData: Partial<CategoryFormData>): Promise<Category> {
        return this.makeRequest(`/${categoryId}`, {
            method: 'PATCH',
            body: JSON.stringify(categoryData),
        });
    }

    static async deleteCategory(categoryId: string): Promise<void> {
        return this.makeRequest(`/${categoryId}`, {
            method: 'DELETE',
        });
    }
}

// Category Form Component
const CategoryForm: React.FC<{
    category?: Category;
    onSubmit: (data: CategoryFormData) => void;
    onCancel: () => void;
    isLoading: boolean;
}> = ({ category, onSubmit, onCancel, isLoading }) => {
    const [formData, setFormData] = useState<CategoryFormData>({
        name: category?.name || '',
        shortDescription: category?.shortDescription || '',
        description: category?.description || '',
        iconUrl: category?.iconUrl || '',
        isPrimaryAllowed: category?.isPrimaryAllowed ?? true,
        isPublisherSelectable: category?.isPublisherSelectable ?? true,
        sortOrder: category?.sortOrder ?? 0
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(formData);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label htmlFor="name" className="block text-sm font-medium mb-1">
                    Nombre <span className="text-red-500">*</span>
                </label>
                <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ingresa el nombre de la categoría"
                    required
                />
            </div>

            <div>
                <label htmlFor="shortDescription" className="block text-sm font-medium mb-1">
                    Descripción Corta
                </label>
                <Input
                    id="shortDescription"
                    value={formData.shortDescription}
                    onChange={(e) => setFormData(prev => ({ ...prev, shortDescription: e.target.value }))}
                    placeholder="Descripción corta para mostrar en tarjetas"
                />
            </div>

            <div>
                <label htmlFor="description" className="block text-sm font-medium mb-1">
                    Descripción
                </label>
                <textarea
                    id="description"
                    className="w-full min-h-[100px] px-3 py-2 border border-input bg-background text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 rounded-md"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Descripción detallada de la categoría"
                />
            </div>

            <div>
                <label htmlFor="iconUrl" className="block text-sm font-medium mb-1">
                    URL del Ícono
                </label>
                <Input
                    id="iconUrl"
                    value={formData.iconUrl}
                    onChange={(e) => setFormData(prev => ({ ...prev, iconUrl: e.target.value }))}
                    placeholder="https://ejemplo.com/icono.png"
                />
            </div>

            <div>
                <label htmlFor="sortOrder" className="block text-sm font-medium mb-1">
                    Orden de Aparición
                </label>
                <Input
                    id="sortOrder"
                    type="number"
                    min="0"
                    value={formData.sortOrder}
                    onChange={(e) => setFormData(prev => ({ ...prev, sortOrder: parseInt(e.target.value) || 0 }))}
                />
            </div>

            <div className="flex items-center space-x-2">
                <Switch
                    id="isPrimaryAllowed"
                    checked={formData.isPrimaryAllowed}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isPrimaryAllowed: checked }))}
                />
                <label htmlFor="isPrimaryAllowed" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Puede ser categoría primaria
                </label>
            </div>

            <div className="flex items-center space-x-2">
                <Switch
                    id="isPublisherSelectable"
                    checked={formData.isPublisherSelectable}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isPublisherSelectable: checked }))}
                />
                <label htmlFor="isPublisherSelectable" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Seleccionable por publishers
                </label>
            </div>

            <DialogFooter>
                <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
                    Cancelar
                </Button>
                <Button type="submit" disabled={isLoading}>
                    {isLoading && <LucideLoader className="mr-2 h-4 w-4 animate-spin" />}
                    {category ? 'Actualizar' : 'Crear'} Categoría
                </Button>
            </DialogFooter>
        </form>
    );
};

// Main Component
export const ManageCategoriesView: React.FC = () => {
    const { user } = useAuthentication();
    const { toast } = useToast();
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
    const [error, setError] = useState<string | null>(null);

    const loadCategories = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await AdminCategoriesAPI.getCategories();
            setCategories(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
            setError(errorMessage);
            toast({
                title: "Error",
                description: `No se pudieron cargar las categorías: ${errorMessage}`,
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadCategories();
    }, []);

    const handleCreateCategory = async (categoryData: CategoryFormData) => {
        try {
            setIsSubmitting(true);
            const newCategory = await AdminCategoriesAPI.createCategory(categoryData);
            setCategories(prev => [...prev, newCategory.data || newCategory]);
            setIsCreateDialogOpen(false);
            toast({
                title: "Éxito",
                description: "Categoría creada exitosamente",
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
            toast({
                title: "Error",
                description: `No se pudo crear la categoría: ${errorMessage}`,
                variant: "destructive",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEditCategory = async (categoryData: CategoryFormData) => {
        if (!selectedCategory) return;

        try {
            setIsSubmitting(true);
            const updatedCategory = await AdminCategoriesAPI.updateCategory(selectedCategory.id, categoryData);
            setCategories(prev => prev.map(cat => 
                cat.id === selectedCategory.id ? (updatedCategory.data || updatedCategory) : cat
            ));
            setIsEditDialogOpen(false);
            setSelectedCategory(null);
            toast({
                title: "Éxito",
                description: "Categoría actualizada exitosamente",
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
            toast({
                title: "Error",
                description: `No se pudo actualizar la categoría: ${errorMessage}`,
                variant: "destructive",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteCategory = async () => {
        if (!categoryToDelete) return;

        try {
            await AdminCategoriesAPI.deleteCategory(categoryToDelete.id);
            setCategories(prev => prev.filter(cat => cat.id !== categoryToDelete.id));
            setCategoryToDelete(null);
            toast({
                title: "Éxito",
                description: "Categoría eliminada exitosamente",
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
            toast({
                title: "Error",
                description: `No se pudo eliminar la categoría: ${errorMessage}`,
                variant: "destructive",
            });
        }
    };

    const filteredCategories = categories.filter(category =>
        category.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        category.shortDescription?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        category.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (!user?.role || !['admin', 'superadmin'].includes(user.role)) {
        return (
            <div className="p-6">
                <Alert>
                    <AlertDescription>
                        No tienes permisos para acceder a esta sección.
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">Gestión de Categorías</h1>
                    <p className="text-muted-foreground">
                        Administra las categorías de modpacks
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        onClick={loadCategories}
                        variant="outline"
                        size="sm"
                        disabled={loading}
                    >
                        <LucideRefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Actualizar
                    </Button>
                    <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <LucidePlus className="h-4 w-4 mr-2" />
                                Nueva Categoría
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                            <DialogHeader>
                                <DialogTitle>Crear Nueva Categoría</DialogTitle>
                            </DialogHeader>
                            <CategoryForm
                                onSubmit={handleCreateCategory}
                                onCancel={() => setIsCreateDialogOpen(false)}
                                isLoading={isSubmitting}
                            />
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {error && (
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <LucideTag className="h-5 w-5" />
                        Categorías ({filteredCategories.length})
                    </CardTitle>
                    <div className="flex items-center space-x-2">
                        <div className="relative flex-1 max-w-sm">
                            <LucideSearch className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar categorías..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-8"
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center items-center py-8">
                            <LucideLoader className="h-6 w-6 animate-spin" />
                            <span className="ml-2">Cargando categorías...</span>
                        </div>
                    ) : filteredCategories.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            {searchQuery ? 'No se encontraron categorías que coincidan con la búsqueda.' : 'No hay categorías registradas.'}
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nombre</TableHead>
                                    <TableHead>Descripción</TableHead>
                                    <TableHead>Configuración</TableHead>
                                    <TableHead>Orden</TableHead>
                                    <TableHead>Creada</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredCategories.map((category) => (
                                    <TableRow key={category.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                {category.iconUrl && (
                                                    <img 
                                                        src={category.iconUrl} 
                                                        alt="" 
                                                        className="w-6 h-6 rounded object-cover"
                                                        onError={(e) => {
                                                            e.currentTarget.style.display = 'none';
                                                        }}
                                                    />
                                                )}
                                                <div>
                                                    <div className="font-medium">{category.name}</div>
                                                    {category.shortDescription && (
                                                        <div className="text-sm text-muted-foreground">
                                                            {category.shortDescription}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="max-w-xs">
                                            {category.description && (
                                                <div className="text-sm text-muted-foreground truncate">
                                                    {category.description}
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2">
                                                    {category.isPrimaryAllowed ? (
                                                        <Badge variant="secondary">Primaria</Badge>
                                                    ) : (
                                                        <Badge variant="outline">Solo Secundaria</Badge>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {category.isPublisherSelectable ? (
                                                        <LucideEye className="h-3 w-3 text-green-600" />
                                                    ) : (
                                                        <LucideEyeOff className="h-3 w-3 text-gray-400" />
                                                    )}
                                                    <span className="text-xs text-muted-foreground">
                                                        {category.isPublisherSelectable ? 'Publisher' : 'Solo Admin'}
                                                    </span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{category.sortOrder}</Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="text-sm text-muted-foreground">
                                                {new Date(category.createdAt).toLocaleDateString()}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => {
                                                        setSelectedCategory(category);
                                                        setIsEditDialogOpen(true);
                                                    }}
                                                >
                                                    <LucideEdit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => setCategoryToDelete(category)}
                                                >
                                                    <LucideTrash className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Edit Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Editar Categoría</DialogTitle>
                    </DialogHeader>
                    {selectedCategory && (
                        <CategoryForm
                            category={selectedCategory}
                            onSubmit={handleEditCategory}
                            onCancel={() => {
                                setIsEditDialogOpen(false);
                                setSelectedCategory(null);
                            }}
                            isLoading={isSubmitting}
                        />
                    )}
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={!!categoryToDelete} onOpenChange={() => setCategoryToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Confirmar eliminación?</AlertDialogTitle>
                        <AlertDialogDescription>
                            ¿Estás seguro de que deseas eliminar la categoría "{categoryToDelete?.name}"? 
                            Esta acción no se puede deshacer y afectará a todos los modpacks que usen esta categoría.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteCategory}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Eliminar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};