import { AppDataSource } from "@/db/data-source";
import { Publisher } from '@/entities/Publisher';

export class PublisherProfileService {
    private publisherRepository = AppDataSource.getRepository(Publisher);

    public async getProfile(publisherId: string): Promise<any> {
        const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(publisherId);

        const queryBuilder = this.publisherRepository.createQueryBuilder('publisher')
            .leftJoinAndSelect('publisher.modpacks', 'modpack')
            .where(isUuid ? 'publisher.id = :id' : 'publisher.publisherName = :name', {
                id: publisherId,
                name: publisherId
            });

        const publisher = await queryBuilder.getOne();

        if (!publisher) {
            throw new Error('Publisher not found');
        }

        return {
            id: publisher.id,
            publisherName: publisher.publisherName,
            description: publisher.description,
            logoUrl: publisher.logoUrl,
            bannerUrl: publisher.bannerUrl,
            websiteUrl: publisher.websiteUrl,
            discordUrl: publisher.discordUrl,
            twitterUrl: publisher.twitterUrl,
            instagramUrl: publisher.instagramUrl,
            youtubeUrl: publisher.youtubeUrl,
            tiktokUrl: publisher.tiktokUrl,
            isVerified: publisher.verified,
            isPartner: publisher.partnered,
            modpackCount: publisher.modpacks?.length || 0,
            modpacks: publisher.modpacks?.map(m => ({
                id: m.id,
                name: m.name,
                slug: m.slug,
                bannerUrl: m.bannerUrl,
                visibility: m.visibility,
                showUserAsPublisher: false, // Default since this is publisher profile
                publisher: {
                    publisherName: publisher.publisherName,
                    verified: publisher.verified,
                    partnered: publisher.partnered,
                    id: publisher.id
                }
            })) || [],
            // Cooldown info
            nameLastChangedAt: publisher.nameLastChangedAt,
            nextNameChangeAvailable: this.calculateNextNameChange(publisher.nameLastChangedAt)
        };
    }

    public async updateProfile(publisherId: string, data: any, userId: string): Promise<any> {
        const publisher = await this.publisherRepository.findOne({
            where: { id: publisherId }
        });

        if (!publisher) {
            throw new Error('Publisher not found');
        }

        // Check name change cooldown
        if (data.publisherName && data.publisherName !== publisher.publisherName) {
            const nextChange = this.calculateNextNameChange(publisher.nameLastChangedAt);
            if (nextChange && new Date() < nextChange) {
                throw new Error(`Publisher name can only be changed once every 14 days. Next change available at: ${nextChange.toISOString()}`);
            }
            publisher.publisherName = data.publisherName;
            publisher.nameLastChangedAt = new Date();
        }

        if (data.description !== undefined) publisher.description = data.description;
        if (data.logoUrl !== undefined) publisher.logoUrl = data.logoUrl;
        if (data.bannerUrl !== undefined) publisher.bannerUrl = data.bannerUrl;
        if (data.websiteUrl !== undefined) publisher.websiteUrl = data.websiteUrl;
        if (data.discordUrl !== undefined) publisher.discordUrl = data.discordUrl;
        if (data.twitterUrl !== undefined) publisher.twitterUrl = data.twitterUrl;
        if (data.instagramUrl !== undefined) publisher.instagramUrl = data.instagramUrl;
        if (data.youtubeUrl !== undefined) publisher.youtubeUrl = data.youtubeUrl;
        if (data.tiktokUrl !== undefined) publisher.tiktokUrl = data.tiktokUrl;

        await this.publisherRepository.save(publisher);

        return this.getProfile(publisherId);
    }

    private calculateNextNameChange(lastChangedAt?: Date): Date | null {
        if (!lastChangedAt) return null;
        const nextChange = new Date(lastChangedAt);
        nextChange.setDate(nextChange.getDate() + 14);
        return nextChange;
    }
}
