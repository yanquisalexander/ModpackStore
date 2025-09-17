import { Hono } from 'hono';
import { CategoryController } from '../../controllers/Category.controller';

const categoriesRouter = new Hono();

// Public routes for categories
categoriesRouter.get('/publishers', CategoryController.getCategoriesForPublishers);

export default categoriesRouter;