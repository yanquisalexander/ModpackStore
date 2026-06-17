export async function resizeImage(file: File, maxSize: number): Promise<File> {
    const img = await createImageBitmap(file);

    let { width, height } = img;

    if (width <= maxSize && height <= maxSize) {
        img.close();
        return file;
    }

    const ratio = Math.min(maxSize / width, maxSize / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, width, height);
    img.close();

    const blob = await new Promise<Blob>(resolve => canvas.toBlob(b => resolve(b!), file.type));
    return new File([blob], file.name, { type: file.type });
}
