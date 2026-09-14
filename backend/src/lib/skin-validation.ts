import { Image } from "imagescript";
import { ValidationError } from "@/lib/errors/index.ts";

const MAX_SKIN_SIZE = 1 * 1024 * 1024;
const MAX_CAPE_SIZE = 1 * 1024 * 1024;
const SKIN_WIDTH = 64;
const SKIN_LEGACY_HEIGHT = 32;
const SKIN_MODERN_HEIGHT = 64;
const MIN_CAPE_HEIGHT = 32;

export interface ValidationResult {
    bytes: Uint8Array;
    width: number;
    height: number;
    hash: string;
}

export async function validateAndNormalizeSkin(
    fileBytes: Uint8Array,
): Promise<ValidationResult> {
    if (fileBytes.length > MAX_SKIN_SIZE) {
        throw new ValidationError("Skin file too large (max 1 MB)", "SKIN_TOO_LARGE");
    }

    let img: Image;
    try {
        img = await Image.decode(fileBytes);
    } catch {
        throw new ValidationError("Invalid PNG file", "INVALID_PNG");
    }

    const [w, h] = [img.width, img.height];

    if (w !== SKIN_WIDTH) {
        throw new ValidationError(
            `Skin must be ${SKIN_WIDTH} pixels wide (got ${w})`,
            "INVALID_SKIN_DIMENSIONS",
        );
    }

    if (h !== SKIN_MODERN_HEIGHT && h !== SKIN_LEGACY_HEIGHT) {
        throw new ValidationError(
            `Skin height must be ${SKIN_MODERN_HEIGHT} or ${SKIN_LEGACY_HEIGHT} (got ${h})`,
            "INVALID_SKIN_DIMENSIONS",
        );
    }

    let normalized = img;
    if (h === SKIN_LEGACY_HEIGHT) {
        normalized = new Image(SKIN_WIDTH, SKIN_MODERN_HEIGHT);
        normalized.composite(img, 0, 0);
    }

    const encoded = await normalized.encode();
    const bytes = new Uint8Array(encoded);
    const hash = await sha256(bytes);

    return { bytes, width: SKIN_WIDTH, height: SKIN_MODERN_HEIGHT, hash };
}

export async function validateAndNormalizeCape(
    fileBytes: Uint8Array,
): Promise<ValidationResult> {
    if (fileBytes.length > MAX_CAPE_SIZE) {
        throw new ValidationError("Cape file too large (max 1 MB)", "CAPE_TOO_LARGE");
    }

    let img: Image;
    try {
        img = await Image.decode(fileBytes);
    } catch {
        throw new ValidationError("Invalid PNG file", "INVALID_PNG");
    }

    const [w, h] = [img.width, img.height];

    if (w !== h * 2) {
        throw new ValidationError(
            `Cape must have a 2:1 width:height ratio (got ${w}x${h})`,
            "INVALID_CAPE_DIMENSIONS",
        );
    }

    if (h < MIN_CAPE_HEIGHT) {
        throw new ValidationError(
            `Cape must be at least ${MIN_CAPE_HEIGHT} pixels tall (got ${h})`,
            "INVALID_CAPE_DIMENSIONS",
        );
    }

    const encoded = await img.encode();
    const bytes = new Uint8Array(encoded);
    const hash = await sha256(bytes);

    return { bytes, width: w, height: h, hash };
}

async function sha256(data: Uint8Array): Promise<string> {
    const hashBuffer = await crypto.subtle.digest("SHA-256", data.buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
