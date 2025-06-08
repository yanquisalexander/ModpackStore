import multer from "multer";

export const upload = multer({
    dest: 'tmp/uploads', // All uploads are stored in the 'temp/uploads' directory
    // Because we will generate manifests and deltas, and upload to R2 (Cloudflare's object storage)
})

