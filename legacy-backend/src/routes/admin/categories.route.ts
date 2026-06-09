import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { CategoryController } from '../../controllers/Category.controller';
import { 
    createCategorySchema, 
    updateCategorySchema, 
    assignCategorySchema,
    reorderCategoriesSchema,
    categoryQuerySchema
} from '../../validators/category.validators';

const categoriesRouter = new Hono();

// Get all categories (admin view)
categoriesRouter.get('/', zValidator('query', categoryQuerySchema), CategoryController.getAllCategories);

// Get category by ID
categoriesRouter.get('/:categoryId', CategoryController.getCategoryById);

// Create new category
categoriesRouter.post('/', zValidator('json', createCategorySchema), CategoryController.createCategory);

// Update category
categoriesRouter.put('/:categoryId', zValidator('json', updateCategorySchema), CategoryController.updateCategory);

// Delete category
categoriesRouter.delete('/:categoryId', CategoryController.deleteCategory);

// Reorder categories
categoriesRouter.post('/reorder', zValidator('json', reorderCategoriesSchema), CategoryController.reorderCategories);

// Initialize default categories
categoriesRouter.post('/initialize', CategoryController.initializeDefaultCategories);

// Modpack category management
categoriesRouter.post('/modpacks/:modpackId/assign', zValidator('json', assignCategorySchema), CategoryController.assignCategoryToModpack);
categoriesRouter.delete('/modpacks/:modpackId/:categoryId', CategoryController.removeCategoryFromModpack);
categoriesRouter.post('/modpacks/:modpackId/primary', zValidator('json', assignCategorySchema), CategoryController.setPrimaryCategory);
categoriesRouter.get('/modpacks/:modpackId', CategoryController.getModpackCategories);

export default categoriesRouter;