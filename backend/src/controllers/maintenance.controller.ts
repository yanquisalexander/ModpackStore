import { Context } from 'hono';
import { AppDataSource } from '../db/data-source';
import { MaintenanceService } from '../services/maintenance.service';
import { AuditService } from '../services/audit.service';

export class MaintenanceController {
    /**
     * POST /api/admin/maintenance/cleanup-modpack-files
     * Clean up orphaned modpack files
     */
    static async cleanupModpackFiles(c: Context) {
        try {
            const maintenanceService = new MaintenanceService(AppDataSource);
            const result = await maintenanceService.cleanupOrphanedModpackFiles();
            
            // Log admin action
            const user = c.get('user');
            await AuditService.logAdminAccess(user.id, { 
                action: 'cleanup_modpack_files',
                result: { deletedCount: result.deletedCount }
            });
            
            return c.json({
                deletedCount: result.deletedCount
            }, 200);
        } catch (error) {
            console.error('Maintenance cleanup error:', error);
            return c.json({
                error: 'Internal Server Error',
                message: 'Failed to cleanup orphaned files'
            }, 500);
        }
    }
}