import { z } from 'zod';

/**
 * Validator for Patreon tier metadata
 * Only allows boolean, number, and string values
 */
export const patreonMetadataSchema = z.record(
    z.union([
        z.boolean(),
        z.number().finite(),
        z.string()
    ])
);

/**
 * Validate metadata values
 * @param metadata The metadata object to validate
 * @returns Validation result
 */
export function validatePatreonMetadata(metadata: any): {
    valid: boolean;
    error?: string;
    data?: Record<string, boolean | number | string>;
} {
    try {
        const validated = patreonMetadataSchema.parse(metadata);

        // Additional check for NaN which is technically a number in JS but invalid in JSON
        for (const [key, value] of Object.entries(validated)) {
            if (typeof value === 'number' && isNaN(value)) {
                return { valid: false, error: `Invalid number value for key ${key}: NaN is not allowed` };
            }
        }

        return { valid: true, data: validated };
    } catch (error) {
        if (error instanceof z.ZodError) {
            console.error('[VALIDATOR] Zod Error:', error.format());
            const firstError = error.errors[0];
            return {
                valid: false,
                error: `Invalid metadata value at ${firstError.path.join('.') || 'root'}: ${firstError.message}`
            };
        }
        return {
            valid: false,
            error: 'Invalid metadata format'
        };
    }
}
