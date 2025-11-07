import { z } from 'zod';

/**
 * Validator for Patreon tier metadata
 * Only allows boolean, number, and string values
 */
export const patreonMetadataSchema = z.record(
    z.string(),
    z.union([
        z.boolean(),
        z.number(),
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
        return { valid: true, data: validated };
    } catch (error) {
        if (error instanceof z.ZodError) {
            const firstError = error.errors[0];
            return { 
                valid: false, 
                error: `Invalid metadata value: ${firstError.message}` 
            };
        }
        return { 
            valid: false, 
            error: 'Invalid metadata format' 
        };
    }
}
