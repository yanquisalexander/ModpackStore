// backend/src/lib/APIError.ts

export class APIError extends Error {
    statusCode: number;
    errorCode?: string;
    metadata?: Record<string, any>;

    constructor(statusCode: number, message: string, errorCode?: string, metadata?: Record<string, any>) {
        super(message);
        this.name = 'APIError';
        this.statusCode = statusCode;
        this.errorCode = errorCode;
        this.metadata = metadata;
        Error.captureStackTrace(this, this.constructor);
    }
}
