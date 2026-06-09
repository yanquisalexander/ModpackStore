import { Hono } from 'hono';
import { MaintenanceController } from '../../controllers/maintenance.controller';
import { ensureAdmin } from '../../middlewares/adminAuth.middleware';

const maintenanceRoute = new Hono();

maintenanceRoute.use('*', ensureAdmin);

maintenanceRoute.post('/cleanup-modpack-files', MaintenanceController.cleanupModpackFiles);

export default maintenanceRoute;