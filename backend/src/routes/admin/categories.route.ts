import { Hono } from 'hono';
import { AdminCategoriesController } from '../../controllers/AdminCategories.controller';
import { ensureAdmin } from '../../middlewares/adminAuth.middleware';

const categoriesRoute = new Hono();

categoriesRoute.use('*', ensureAdmin);

categoriesRoute.get('/', AdminCategoriesController.listCategories);
categoriesRoute.post('/', AdminCategoriesController.createCategory);
categoriesRoute.get('/publisher-selectable', AdminCategoriesController.getPublisherSelectableCategories);
categoriesRoute.get('/primary-allowed', AdminCategoriesController.getPrimaryAllowedCategories);
categoriesRoute.get('/:categoryId', AdminCategoriesController.getCategory);
categoriesRoute.patch('/:categoryId', AdminCategoriesController.updateCategory);
categoriesRoute.delete('/:categoryId', AdminCategoriesController.deleteCategory);

export default categoriesRoute;