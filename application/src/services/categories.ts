import { API_ENDPOINT } from "../consts";

export interface CategoryData {
    id: string;
    name: string;
    shortDescription?: string;
    description?: string;
    iconUrl?: string;
    displayOrder: number;
    isAdminOnly: boolean;
    isSelectable: boolean;
    isAutomatic: boolean;
    createdAt: string;
}

export interface ModpackCategoryData {
    id: number;
    modpackId: string;
    categoryId: string;
    isPrimary: boolean;
    category: CategoryData;
}

export interface CreateCategoryData {
    name: string;
    shortDescription?: string;
    description?: string;
    iconUrl?: string;
    displayOrder?: number;
    isAdminOnly?: boolean;
    isSelectable?: boolean;
    isAutomatic?: boolean;
}

export interface UpdateCategoryData extends Partial<CreateCategoryData> {}

export interface AssignCategoryData {
    categoryId: string;
    isPrimary?: boolean;
}

export interface ReorderCategoryData {
    id: string;
    displayOrder: number;
}

export interface CategoryQueryParams {
    includeAdminOnly?: boolean;
    onlySelectable?: boolean;
    includeAutomatic?: boolean;
}

export interface CategoryListResponse {
    success: boolean;
    data: CategoryData[];
    meta: {
        total: number;
    };
}

export interface CategoryResponse {
    success: boolean;
    data: CategoryData;
    message?: string;
}

export interface ModpackCategoriesResponse {
    success: boolean;
    data: ModpackCategoryData[];
    meta: {
        total: number;
        primary: CategoryData | null;
    };
}

export interface ApiResponse {
    success: boolean;
    message: string;
}

/**
 * Helper function to handle API responses.
 */
async function handleResponse<T>(response: Response): Promise<T> {
    const data = await response.json();
    
    if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
    }
    
    return data;
}

/**
 * Admin Category Management Service
 */
export class AdminCategoryService {
    private static getAuthHeaders(token: string) {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    }

    /**
     * Get all categories (admin view)
     */
    static async getAllCategories(token: string, params?: CategoryQueryParams): Promise<CategoryListResponse> {
        const searchParams = new URLSearchParams();
        if (params?.includeAdminOnly !== undefined) {
            searchParams.append('includeAdminOnly', params.includeAdminOnly.toString());
        }
        if (params?.onlySelectable !== undefined) {
            searchParams.append('onlySelectable', params.onlySelectable.toString());
        }
        if (params?.includeAutomatic !== undefined) {
            searchParams.append('includeAutomatic', params.includeAutomatic.toString());
        }

        const url = `${API_ENDPOINT}/admin/categories${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: AdminCategoryService.getAuthHeaders(token)
        });

        return handleResponse<CategoryListResponse>(response);
    }

    /**
     * Get category by ID
     */
    static async getCategoryById(token: string, categoryId: string): Promise<CategoryResponse> {
        const response = await fetch(`${API_ENDPOINT}/admin/categories/${categoryId}`, {
            method: 'GET',
            headers: AdminCategoryService.getAuthHeaders(token)
        });

        return handleResponse<CategoryResponse>(response);
    }

    /**
     * Create a new category
     */
    static async createCategory(token: string, categoryData: CreateCategoryData): Promise<CategoryResponse> {
        const response = await fetch(`${API_ENDPOINT}/admin/categories`, {
            method: 'POST',
            headers: AdminCategoryService.getAuthHeaders(token),
            body: JSON.stringify(categoryData)
        });

        return handleResponse<CategoryResponse>(response);
    }

    /**
     * Update a category
     */
    static async updateCategory(token: string, categoryId: string, categoryData: UpdateCategoryData): Promise<CategoryResponse> {
        const response = await fetch(`${API_ENDPOINT}/admin/categories/${categoryId}`, {
            method: 'PUT',
            headers: AdminCategoryService.getAuthHeaders(token),
            body: JSON.stringify(categoryData)
        });

        return handleResponse<CategoryResponse>(response);
    }

    /**
     * Delete a category
     */
    static async deleteCategory(token: string, categoryId: string): Promise<ApiResponse> {
        const response = await fetch(`${API_ENDPOINT}/admin/categories/${categoryId}`, {
            method: 'DELETE',
            headers: AdminCategoryService.getAuthHeaders(token)
        });

        return handleResponse<ApiResponse>(response);
    }

    /**
     * Reorder categories
     */
    static async reorderCategories(token: string, categories: ReorderCategoryData[]): Promise<ApiResponse> {
        const response = await fetch(`${API_ENDPOINT}/admin/categories/reorder`, {
            method: 'POST',
            headers: AdminCategoryService.getAuthHeaders(token),
            body: JSON.stringify({ categories })
        });

        return handleResponse<ApiResponse>(response);
    }

    /**
     * Initialize default categories
     */
    static async initializeDefaultCategories(token: string): Promise<ApiResponse> {
        const response = await fetch(`${API_ENDPOINT}/admin/categories/initialize`, {
            method: 'POST',
            headers: AdminCategoryService.getAuthHeaders(token)
        });

        return handleResponse<ApiResponse>(response);
    }

    /**
     * Assign category to modpack
     */
    static async assignCategoryToModpack(token: string, modpackId: string, assignData: AssignCategoryData): Promise<CategoryResponse> {
        const response = await fetch(`${API_ENDPOINT}/admin/categories/modpacks/${modpackId}/assign`, {
            method: 'POST',
            headers: AdminCategoryService.getAuthHeaders(token),
            body: JSON.stringify(assignData)
        });

        return handleResponse<CategoryResponse>(response);
    }

    /**
     * Remove category from modpack
     */
    static async removeCategoryFromModpack(token: string, modpackId: string, categoryId: string): Promise<ApiResponse> {
        const response = await fetch(`${API_ENDPOINT}/admin/categories/modpacks/${modpackId}/${categoryId}`, {
            method: 'DELETE',
            headers: AdminCategoryService.getAuthHeaders(token)
        });

        return handleResponse<ApiResponse>(response);
    }

    /**
     * Set primary category for modpack
     */
    static async setPrimaryCategory(token: string, modpackId: string, categoryId: string): Promise<ApiResponse> {
        const response = await fetch(`${API_ENDPOINT}/admin/categories/modpacks/${modpackId}/primary`, {
            method: 'POST',
            headers: AdminCategoryService.getAuthHeaders(token),
            body: JSON.stringify({ categoryId })
        });

        return handleResponse<ApiResponse>(response);
    }

    /**
     * Get modpack categories
     */
    static async getModpackCategories(token: string, modpackId: string): Promise<ModpackCategoriesResponse> {
        const response = await fetch(`${API_ENDPOINT}/admin/categories/modpacks/${modpackId}`, {
            method: 'GET',
            headers: AdminCategoryService.getAuthHeaders(token)
        });

        return handleResponse<ModpackCategoriesResponse>(response);
    }
}

/**
 * Public Category Service (for publishers and public access)
 */
export class CategoryService {
    /**
     * Get categories available for publishers
     */
    static async getCategoriesForPublishers(): Promise<CategoryListResponse> {
        const response = await fetch(`${API_ENDPOINT}/categories/publishers`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        return handleResponse<CategoryListResponse>(response);
    }
}