import { Image } from "imagescript";

type ResizeResult = { bytes: Uint8Array; format: string };

export async function resizeImage(
    bytes: Uint8Array,
    maxDimension: number,
): Promise<ResizeResult> {
    const img = await Image.decode(bytes);
    const [w, h] = [img.width, img.height];

    let newW: number;
    let newH: number;
    if (w > h) {
        newW = Math.min(w, maxDimension);
        newH = Math.round((h / w) * newW);
    } else {
        newH = Math.min(h, maxDimension);
        newW = Math.round((w / h) * newH);
    }

    img.resize(newW, newH);

    const resizedBytes = await img.encodeWEBP(80);
    return { bytes: resizedBytes, format: "image/webp" };
}
