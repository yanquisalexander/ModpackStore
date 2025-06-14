// backend/src/lib/APIError.ts

export class APIError extends Error {
    statusCode: number;
    errorCode?: string;

    constructor(statusCode: number, message: string, errorCode?: string) {
        super(message);
        this.name = 'APIError';
        this.statusCode = statusCode;
        this.errorCode = errorCode;
        Error.captureStackTrace(this, this.constructor);
    }
}
