import crypto from 'crypto';

/**
 * Generate an ETag from JSON data
 * @param data Any JSON-serializable data
 * @returns ETag string in format "hash"
 */
export function generateETag(data: any): string {
    const json = JSON.stringify(data);
    const hash = crypto
        .createHash('md5')
        .update(json)
        .digest('hex');
    return `"${hash}"`;
}

/**
 * Check if request ETag matches current ETag
 * @param requestETag ETag from If-None-Match header
 * @param currentETag Current ETag of the resource
 * @returns true if ETags match (304 should be returned)
 */
export function etagMatches(requestETag: string | undefined, currentETag: string): boolean {
    if (!requestETag) {
        return false;
    }
    
    // Handle multiple ETags in If-None-Match
    const requestETags = requestETag.split(',').map(tag => tag.trim());
    return requestETags.includes(currentETag) || requestETags.includes('*');
}
