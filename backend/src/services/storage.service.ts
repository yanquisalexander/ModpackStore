import { PublisherFile } from "@/entities/PublisherFile";
import { Publisher } from "@/entities/Publisher";
import { uploadToR2, deleteFromR2 } from "./r2UploadService";
import { APIError } from "@/lib/APIError";

export class StorageService {
    /**
     * Get all files for a publisher
     */
    async getPublisherFiles(publisherId: string): Promise<PublisherFile[]> {
        const files = await PublisherFile.find({
            where: { publisherId },
            order: { uploadedAt: "DESC" }
        });
        return files;
    }

    /**
     * Get storage usage for a publisher
     */
    async getStorageUsage(publisherId: string): Promise<{ usedKb: number; limitKb: number; availableKb: number; percentage: number }> {
        const publisher = await Publisher.findOne({ where: { id: publisherId } });
        if (!publisher) {
            throw new APIError(404, "Publisher not found");
        }

        const files = await PublisherFile.find({ where: { publisherId } });
        const usedKb = files.reduce((total, file) => total + file.fileSizeKb, 0);
        const limitKb = publisher.storageLimitKb;
        const availableKb = Math.max(0, limitKb - usedKb);
        const percentage = limitKb > 0 ? (usedKb / limitKb) * 100 : 0;

        return {
            usedKb,
            limitKb,
            availableKb,
            percentage: Math.min(100, Math.round(percentage * 100) / 100)
        };
    }

    /**
     * Upload a file to publisher storage
     */
    async uploadFile(
        publisherId: string,
        fileName: string,
        fileBuffer: Buffer,
        contentType: string
    ): Promise<PublisherFile> {
        // Get publisher and verify existence
        const publisher = await Publisher.findOne({ where: { id: publisherId } });
        if (!publisher) {
            throw new APIError(404, "Publisher not found");
        }

        // Calculate file size in KB
        const fileSizeKb = Math.ceil(fileBuffer.length / 1024);

        // Check storage limit
        const usage = await this.getStorageUsage(publisherId);
        if (usage.usedKb + fileSizeKb > usage.limitKb) {
            throw new APIError(
                400,
                `Storage limit exceeded. Available: ${usage.availableKb} KB, Required: ${fileSizeKb} KB`
            );
        }

        // Check if file with same name exists
        const existingFile = await PublisherFile.findOne({
            where: { publisherId, fileName }
        });

        // Generate R2 key
        const r2Key = `publisher-uploads/${publisherId}/${fileName}`;

        // Upload to R2
        const uploadResult = await uploadToR2(r2Key, fileBuffer, contentType);

        // If file exists, update it; otherwise create new
        if (existingFile) {
            // Delete old file from R2 if key changed (shouldn't happen with same name)
            if (existingFile.r2Key !== r2Key) {
                try {
                    await deleteFromR2(existingFile.r2Key);
                } catch (error) {
                    console.error("Error deleting old file from R2:", error);
                    // Continue even if deletion fails
                }
            }

            // Update existing record
            existingFile.fileSizeKb = fileSizeKb;
            existingFile.r2Key = r2Key;
            existingFile.contentType = contentType;
            existingFile.uploadedAt = new Date();
            await existingFile.save();
            return existingFile;
        } else {
            // Create new record
            const file = PublisherFile.create({
                publisherId,
                fileName,
                fileSizeKb,
                r2Key,
                contentType
            });
            await file.save();
            return file;
        }
    }

    /**
     * Delete a file from publisher storage
     */
    async deleteFile(publisherId: string, fileId: string): Promise<void> {
        const file = await PublisherFile.findOne({
            where: { id: fileId, publisherId }
        });

        if (!file) {
            throw new APIError(404, "File not found");
        }

        // Delete from R2
        try {
            await deleteFromR2(file.r2Key);
        } catch (error) {
            console.error("Error deleting file from R2:", error);
            // Continue to delete DB record even if R2 deletion fails
        }

        // Delete from database
        await file.remove();
    }

    /**
     * Get a single file by ID
     */
    async getFile(publisherId: string, fileId: string): Promise<PublisherFile> {
        const file = await PublisherFile.findOne({
            where: { id: fileId, publisherId }
        });

        if (!file) {
            throw new APIError(404, "File not found");
        }

        return file;
    }

    /**
     * Get CDN URL for a file
     */
    getCdnUrl(r2Key: string): string {
        const R2_CDN_URL = process.env.R2_CDN_URL || "";
        const R2_ENDPOINT = process.env.R2_ENDPOINT || "";
        
        const baseUrl = R2_CDN_URL || R2_ENDPOINT;
        return `${baseUrl}/${r2Key}?t=${Date.now()}`;
    }
}
