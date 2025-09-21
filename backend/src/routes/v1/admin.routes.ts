import { Hono } from 'hono';
import adminUsersRouter from '../admin/users.route';
import adminAuditRouter from '../admin/audit.route';
import adminPublishersRouter from '../admin/publishers.route';
import adminMaintenanceRouter from '../admin/maintenance.route';
import adminTicketsRouter from '../admin/tickets.route';
import adminWithdrawalsRouter from '../admin/withdrawals.route';
import adminCategoriesRouter from '../admin/categories.route';
import systemSettingsRouter from '../admin/system-settings.route';
import { requireAuth } from '../../middlewares/auth.middleware';

const adminRoutes = new Hono();

// Apply authentication middleware to all admin routes
adminRoutes.use('*', requireAuth);

// Mount the sub-routers
adminRoutes.route('/users', adminUsersRouter);
adminRoutes.route('/audit', adminAuditRouter);
adminRoutes.route('/publishers', adminPublishersRouter);
adminRoutes.route('/maintenance', adminMaintenanceRouter);
adminRoutes.route('/tickets', adminTicketsRouter);
adminRoutes.route('/withdrawals', adminWithdrawalsRouter);
adminRoutes.route('/categories', adminCategoriesRouter);
adminRoutes.route('/settings', systemSettingsRouter);

export default adminRoutes;
