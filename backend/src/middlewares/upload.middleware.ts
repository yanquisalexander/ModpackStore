import multer, { FileFilterCallback } from "multer";
import { Request } from 'express';
import path from 'path';

// Define a reasonable file size limit (e.g., 100MB). Adjust as necessary.
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

// Define allowed mime types or extensions.
// Example: Allow ZIP files, common for modpacks. Customize as needed.
const allowedMimeTypes = ['application/zip', 'application/x-zip-compressed'];
// It's often better to check magic numbers or use more robust type checking if possible,
// but mime type checking is a good first step.

const fileFilter = (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true); // Accept file
    } else {
        // Reject file
        // Pass an error message that can be caught by an error-handling middleware.
        cb(new Error(`Invalid file type. Only ${allowedMimeTypes.join(', ')} are allowed.`));
    }
};

export const upload = multer({
    dest: 'tmp/uploads', // All uploads are stored in the 'tmp/uploads' directory
                         // Ensure this directory exists or multer might throw errors.
    limits: {
        fileSize: MAX_FILE_SIZE,
    },
    fileFilter: fileFilter,
    // Note: Multer errors (like file size limit exceeded or invalid file type) will be passed
    // to the Express error handling middleware chain. Ensure you have a middleware
    // set up to catch these errors and respond to the client appropriately.
    // Example of such an error: err.code === 'LIMIT_FILE_SIZE'
});

// It's crucial to handle cleanup of files in 'tmp/uploads'.
// After successful processing (e.g., upload to R2), these temporary files should be deleted.
// If processing fails, they should also be cleaned up. This logic typically resides
// in the route handlers or services that use this upload middleware.

