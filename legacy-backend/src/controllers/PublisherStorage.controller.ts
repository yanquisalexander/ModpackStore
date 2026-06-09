import { Context } from 'hono';
import sharp from 'sharp';
import { uploadToR2 } from '@/services/r2UploadService';
import { Publisher } from '@/entities/Publisher';

export class PublisherStorageController {

    public static uploadImage = async (c: Context) => {
        const publisherId = c.req.param('publisherId');
        const type = c.req.param('type'); // 'logo' or 'banner'

        if (type !== 'logo' && type !== 'banner') {
            throw new Error('Invalid upload type. Must be "logo" or "banner".');
        }

        const body = await c.req.parseBody();
        const file = body['file'];

        if (!file || !(file instanceof File)) {
            throw new Error('No file uploaded or invalid file format.');
        }

        // Always convert to WebP
        const fileBuffer = await file.arrayBuffer();
        const optimizedBuffer = await sharp(Buffer.from(fileBuffer))
            .webp({ quality: 80 })
            .toBuffer();

        const key = `publishers/${publisherId}/${type}.webp`;

        const result = await uploadToR2(key, optimizedBuffer, 'image/webp');

        // Append timestamp for cache busting on the client/DB side
        const timestamp = Date.now();
        const baseUrl = result.cdnUrl || result.url;
        const urlWithCacheBust = `${baseUrl}?t=${timestamp}`;

        // Save to Database
        await Publisher.update(publisherId, {
            [type === 'logo' ? 'logoUrl' : 'bannerUrl']: urlWithCacheBust
        });

        return c.json({
            message: 'Image uploaded successfully',
            url: urlWithCacheBust,
            key: key
        });
    };
}
