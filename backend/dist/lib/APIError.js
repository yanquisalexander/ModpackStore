"use strict";
// backend/src/lib/APIError.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.APIError = void 0;
class APIError extends Error {
    constructor(statusCode, message, errorCode) {
        super(message);
        this.name = 'APIError';
        this.statusCode = statusCode;
        this.errorCode = errorCode;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.APIError = APIError;
