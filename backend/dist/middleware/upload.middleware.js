"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.upload = void 0;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// Ensure the upload directory exists
const uploadDir = path_1.default.join(__dirname, '../../tmp/uploads');
if (!fs_1.default.existsSync(uploadDir)) {
    fs_1.default.mkdirSync(uploadDir, { recursive: true });
}
// Configure multer storage
const storage = multer_1.default.memoryStorage(); // Store files in memory as Buffer
// Configure file filter to validate file types
const fileFilter = (req, file, cb) => {
    // Accept zip files for modpack versions (mods, configs, resources) and images for logos
    if ((file.fieldname === 'versionFile' || file.fieldname === 'configsFile' || file.fieldname === 'resourcesFile') &&
        file.mimetype === 'application/zip') {
        cb(null, true);
    }
    else if ((file.fieldname === 'logo' || file.fieldname === 'banner') &&
        file.mimetype.startsWith('image/')) {
        cb(null, true);
    }
    else {
        cb(new Error('Unsupported file type'));
    }
};
// Configure multer with limits
exports.upload = (0, multer_1.default)({
    storage,
    fileFilter,
    limits: {
        fileSize: 100 * 1024 * 1024, // 100MB max file size
    },
});
