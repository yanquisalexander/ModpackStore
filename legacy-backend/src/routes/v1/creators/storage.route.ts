import { Hono } from "hono";
import { Context } from "hono";
import { AuthVariables, requireAuth, requireCreatorAccess, isOrganizationMember, USER_CONTEXT_KEY } from "@/middlewares/auth.middleware";
import { StorageService } from "@/services/storage.service";
import { APIError } from "@/lib/APIError";
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES, ALLOWED_EXTENSIONS } from "@/validators/storage.validator";

export const StorageRoute = new Hono();

// All storage routes require authentication and creator access
StorageRoute.use(requireAuth, requireCreatorAccess);

const storageService = new StorageService();

/**
 * GET /creators/publishers/:publisherId/storage
 * Get all files for a publisher
 */
StorageRoute.get(
    "/publishers/:publisherId/storage",
    isOrganizationMember,
    async (c: Context<{ Variables: AuthVariables }>) => {
        const { publisherId } = c.req.param();

        try {
            const files = await storageService.getPublisherFiles(publisherId);
            
            // Add CDN URL to each file
            const filesWithUrls = files.map(file => ({
                ...file,
                cdnUrl: storageService.getCdnUrl(file.r2Key)
            }));

            return c.json({ success: true, files: filesWithUrls });
        } catch (error) {
            console.error("Error fetching files:", error);
            throw new APIError(500, "Failed to fetch files");
        }
    }
);

/**
 * GET /creators/publishers/:publisherId/storage/usage
 * Get storage usage for a publisher
 */
StorageRoute.get(
    "/publishers/:publisherId/storage/usage",
    isOrganizationMember,
    async (c: Context<{ Variables: AuthVariables }>) => {
        const { publisherId } = c.req.param();

        try {
            const usage = await storageService.getStorageUsage(publisherId);
            return c.json({ success: true, usage });
        } catch (error) {
            console.error("Error fetching storage usage:", error);
            throw new APIError(500, "Failed to fetch storage usage");
        }
    }
);

/**
 * POST /creators/publishers/:publisherId/storage/upload
 * Upload a file to publisher storage
 */
StorageRoute.post(
    "/publishers/:publisherId/storage/upload",
    isOrganizationMember,
    async (c: Context<{ Variables: AuthVariables }>) => {
        const { publisherId } = c.req.param();

        try {
            // Parse multipart form data
            const body = await c.req.parseBody();
            const file = body.file;

            if (!file || typeof file === 'string') {
                throw new APIError(400, "No file provided");
            }

            // Get file info
            const fileName = file.name;
            const contentType = file.type;

            // Validate file type
            if (!ALLOWED_MIME_TYPES.includes(contentType)) {
                // Check file extension as fallback
                const fileExt = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
                if (!ALLOWED_EXTENSIONS.includes(fileExt)) {
                    throw new APIError(400, "File type not allowed. Allowed types: images, audio, and video files");
                }
            }

            // Validate file size
            if (file.size > MAX_FILE_SIZE_BYTES) {
                throw new APIError(400, "File size exceeds maximum allowed (50 MB)");
            }

            // Read file buffer
            const arrayBuffer = await file.arrayBuffer();
            const fileBuffer = Buffer.from(arrayBuffer);

            // Upload file
            const uploadedFile = await storageService.uploadFile(
                publisherId,
                fileName,
                fileBuffer,
                contentType
            );

            return c.json({
                success: true,
                message: "File uploaded successfully",
                file: {
                    ...uploadedFile,
                    cdnUrl: storageService.getCdnUrl(uploadedFile.r2Key)
                }
            });
        } catch (error) {
            console.error("Error uploading file:", error);
            if (error instanceof APIError) {
                throw error;
            }
            throw new APIError(500, "Failed to upload file");
        }
    }
);

/**
 * DELETE /creators/publishers/:publisherId/storage/:fileId
 * Delete a file from publisher storage
 */
StorageRoute.delete(
    "/publishers/:publisherId/storage/:fileId",
    isOrganizationMember,
    async (c: Context<{ Variables: AuthVariables }>) => {
        const { publisherId, fileId } = c.req.param();

        try {
            await storageService.deleteFile(publisherId, fileId);
            return c.json({ success: true, message: "File deleted successfully" });
        } catch (error) {
            console.error("Error deleting file:", error);
            if (error instanceof APIError) {
                throw error;
            }
            throw new APIError(500, "Failed to delete file");
        }
    }
);
