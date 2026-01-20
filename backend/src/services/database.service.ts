import { AppDataSource } from '../db/data-source';

/**
 * Servicio singleton para manejar el estado de la conexión a la base de datos
 * Evita verificaciones innecesarias en cada petición y mantiene el estado global
 */
export class DatabaseService {
    private static instance: DatabaseService;
    private isReady: boolean = false;
    private isInitializing: boolean = false;
    private initializationPromise: Promise<void> | null = null;

    private constructor() { }

    /**
     * Obtiene la instancia singleton del servicio
     */
    public static getInstance(): DatabaseService {
        if (!DatabaseService.instance) {
            DatabaseService.instance = new DatabaseService();
        }
        return DatabaseService.instance;
    }

    /**
     * Verifica si la base de datos está lista para recibir conexiones
     * Si no está inicializada, inicia el proceso de inicialización
     */
    public async ensureDatabaseReady(): Promise<void> {
        if (this.isReady) {
            return; // Ya está listo
        }

        if (this.isInitializing && this.initializationPromise) {
            // Ya se está inicializando, esperar a que termine
            return this.initializationPromise;
        }

        // Iniciar inicialización
        this.isInitializing = true;
        this.initializationPromise = this.initializeDatabase();

        try {
            await this.initializationPromise;
            this.isReady = true;
        } finally {
            this.isInitializing = false;
            this.initializationPromise = null;
        }
    }

    /**
     * Verifica si la base de datos está lista (solo lectura, no inicia inicialización)
     */
    public isDatabaseReady(): boolean {
        return this.isReady && AppDataSource.isInitialized;
    }

    /**
     * Fuerza una verificación de la conexión a la base de datos
     */
    public async checkConnection(): Promise<boolean> {
        try {
            if (!AppDataSource.isInitialized) {
                return false;
            }
            await AppDataSource.query('SELECT 1');
            return true;
        } catch (error) {
            console.warn('Database connection check failed:', error);
            this.isReady = false;
            return false;
        }
    }

    /**
     * Inicializa la base de datos con reintentos
     */
    private async initializeDatabase(): Promise<void> {
        const maxRetries = 12; // Aumentado para soportar cold starts más largos (aprox 45-60s total)
        let retries = 0;

        while (retries < maxRetries) {
            try {
                console.log(`[Database] Attempting connection (attempt ${retries + 1}/${maxRetries})...`);

                if (!AppDataSource.isInitialized) {
                    await AppDataSource.initialize();
                    console.log('[Database] Connection established successfully.');
                }

                // Verificar que realmente podemos hacer consultas
                await AppDataSource.query('SELECT 1');
                console.log('[Database] Ready for queries.');
                return;

            } catch (error) {
                console.error(`[Database] Initialization failed (attempt ${retries + 1}/${maxRetries}):`, error);
                retries++;

                if (retries < maxRetries) {
                    // Esperar con backoff exponencial mejorado para dar más margen al DB
                    // 1s, 2s, 4s, 8s, 8s, 8s...
                    const delay = Math.min(1000 * Math.pow(2, Math.min(retries - 1, 3)), 8000);
                    console.log(`[Database] Retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        // Si llegamos aquí, agotamos los reintentos
        throw new Error('Failed to initialize database after multiple retries. Cold start timed out.');
    }

    /**
     * Reinicia el estado del servicio (útil para testing o recuperación manual)
     */
    public reset(): void {
        this.isReady = false;
        this.isInitializing = false;
        this.initializationPromise = null;
    }
}

// Exportar instancia singleton para uso directo
export const databaseService = DatabaseService.getInstance();