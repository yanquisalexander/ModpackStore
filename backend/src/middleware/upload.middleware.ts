import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Ensure the upload directory exists
const uploadDir = path.join(__dirname, '../../tmp/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer storage
const storage = multer.memoryStorage(); // Store files in memory as Buffer

// Configure file filter to validate file types
const fileFilter = (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Accept zip files for modpack versions (mods, configs, resources) and images for logos
  if ((file.fieldname === 'versionFile' || file.fieldname === 'configsFile' || file.fieldname === 'resourcesFile') && 
      file.mimetype === 'application/zip') {
    cb(null, true);
  } else if ((file.fieldname === 'logo' || file.fieldname === 'banner') && 
             file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Unsupported file type'));
  }
};

// Configure multer with limits
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max file size
  },
});