import { z } from "zod";

// Allowed file types for publisher storage
export const ALLOWED_MIME_TYPES = [
    // Images
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
    // Audio
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/ogg",
    "audio/webm",
    // Video
    "video/mp4",
    "video/webm",
    "video/ogg",
    "video/quicktime"
];

export const ALLOWED_EXTENSIONS = [
    // Images
    ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg",
    // Audio
    ".mp3", ".wav", ".ogg", ".oga",
    // Video
    ".mp4", ".webm", ".ogv", ".mov"
];

// Maximum file size: 50 MB
export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

export const uploadFileSchema = z.object({
    fileName: z.string().min(1).max(255),
    contentType: z.string().refine(
        (type) => ALLOWED_MIME_TYPES.includes(type),
        { message: "File type not allowed" }
    ),
    fileSize: z.number().max(MAX_FILE_SIZE_BYTES, "File size exceeds maximum allowed (50 MB)")
});

export const deleteFileSchema = z.object({
    fileId: z.string().uuid()
});
