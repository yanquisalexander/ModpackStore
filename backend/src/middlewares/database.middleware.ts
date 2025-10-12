import { Context, Next } from 'hono';
import { APIError } from '../lib/APIError';
import { databaseService } from '../services/database.service';

/**
 * Middleware que verifica si la base de datos está inicializada usando el servicio singleton
 * Si no lo está, espera a que se inicialice. Si falla después de reintentos, devuelve error 503
 */
export const requireDatabaseReady = async (c: Context, next: Next) => {
    try {
        // El servicio singleton maneja la inicialización y reintentos automáticamente
        await databaseService.ensureDatabaseReady();

        // Si llegamos aquí, la base de datos está lista
        return next();
    } catch (error) {
        // Si el servicio falla después de todos los reintentos, devolver error 503
        console.error('Database initialization failed:', error);
        throw new APIError(503, 'La base de datos no está disponible temporalmente. Por favor, inténtelo de nuevo en unos momentos.');
    }
};