import { Hono } from 'hono';
import adminUsersRouter from '../admin/users.route';
import adminAuditRouter from '../admin/audit.route';
import adminPublishersRouter from '../admin/publishers.route';
import { requireAuth } from '../../middlewares/auth.middleware';

const adminRoutes = new Hono();

// Apply authentication middleware to all admin routes
adminRoutes.use('*', requireAuth);

// Mount the sub-routers
adminRoutes.route('/users', adminUsersRouter);
adminRoutes.route('/audit', adminAuditRouter);
adminRoutes.route('/publishers', adminPublishersRouter);

export default adminRoutes;
