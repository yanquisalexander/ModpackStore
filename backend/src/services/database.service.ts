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
        const maxRetries = 5;
        let retries = 0;

        while (retries < maxRetries) {
            try {
                console.log(`Attempting database connection (attempt ${retries + 1}/${maxRetries})...`);

                if (!AppDataSource.isInitialized) {
                    await AppDataSource.initialize();
                    console.log('Database connection established successfully.');
                }

                // Verificar que realmente podemos hacer consultas
                await AppDataSource.query('SELECT 1');
                console.log('Database ready for queries.');
                return;

            } catch (error) {
                console.error(`Database initialization failed (attempt ${retries + 1}/${maxRetries}):`, error);
                retries++;

                if (retries < maxRetries) {
                    // Esperar con backoff exponencial: 500ms, 1000ms, 2000ms, 4000ms
                    const delay = Math.min(500 * Math.pow(2, retries - 1), 4000);
                    console.log(`Retrying database connection in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        // Si llegamos aquí, agotamos los reintentos
        throw new Error('Failed to initialize database after multiple retries. The database may be in auto-sleep mode.');
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