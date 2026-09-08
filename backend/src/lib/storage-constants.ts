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
    "video/quicktime",
];

export const ALLOWED_EXTENSIONS = [
    // Images
    ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg",
    // Audio
    ".mp3", ".wav", ".ogg", ".oga",
    // Video
    ".mp4", ".webm", ".ogv", ".mov",
];

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export const DEFAULT_STORAGE_LIMIT_BYTES = 31457280; // 30 MB
export const VERIFIED_STORAGE_LIMIT_BYTES = 209715200; // 200 MB
