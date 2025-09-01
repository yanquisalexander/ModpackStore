import { Hono } from 'hono';
import { AuditController } from '../../controllers/Audit.controller';
import { ensureAdmin } from '../../middlewares/adminAuth.middleware';

const auditRoute = new Hono();

auditRoute.use('*', ensureAdmin);

auditRoute.get('/', AuditController.listAuditLogs);
auditRoute.get('/actions', AuditController.getAuditActions);
auditRoute.get('/:logId', AuditController.getAuditLog);

export default auditRoute;