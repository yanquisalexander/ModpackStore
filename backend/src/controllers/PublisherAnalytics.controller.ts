import { Context } from 'hono';
import { User } from '@/entities/User';
import { Modpack } from '@/entities/Modpack';
import { ModpackVersion } from '@/entities/ModpackVersion';
import { APIError } from '@/lib/APIError';
import { AuthVariables, USER_CONTEXT_KEY } from "@/middlewares/auth.middleware";

interface AnalyticsQuery {
    period?: string;
    modpack?: string;
}

export class PublisherAnalyticsController {
    /**
     * Get publisher analytics data
     */
    static async getAnalytics(c: Context<{ Variables: AuthVariables }>): Promise<Response> {
        const userId = c.get('userId');
        const query = c.req.query() as AnalyticsQuery;
        const period = query.period || '30d';
        const modpackFilter = query.modpack || 'all';

        // Get user's publishers
        const user = await User.findOne({
            where: { id: userId },
            relations: ['publisherMemberships', 'publisherMemberships.publisher']
        });

        if (!user || !user.publisherMemberships || user.publisherMemberships.length === 0) {
            throw new APIError(403, 'User is not a member of any publisher', 'NOT_A_PUBLISHER_MEMBER');
        }

        const publisherIds = user.publisherMemberships.map(pm => pm.publisher.id);

        // Calculate date range
        const endDate = new Date();
        const startDate = new Date();

        switch (period) {
            case '7d':
                startDate.setDate(endDate.getDate() - 7);
                break;
            case '30d':
                startDate.setDate(endDate.getDate() - 30);
                break;
            case '90d':
                startDate.setDate(endDate.getDate() - 90);
                break;
            case '1y':
                startDate.setFullYear(endDate.getFullYear() - 1);
                break;
            default:
                startDate.setDate(endDate.getDate() - 30);
        }

        // Get modpacks for this publisher
        let modpackQuery = Modpack.createQueryBuilder('m')
            .where('m.publisherId IN (:...publisherIds)', { publisherIds });

        if (modpackFilter !== 'all') {
            modpackQuery = modpackQuery.andWhere('m.id = :modpackId', { modpackId: modpackFilter });
        }

        const modpacks = await modpackQuery.getMany();

        // Mock data for now - in a real implementation, this would come from analytics tables
        const analyticsData = {
            retention: {
                averageRetentionDays: 14.5,
                retentionByModpack: modpacks.map(modpack => ({
                    modpackName: modpack.name,
                    averageRetentionDays: Math.random() * 20 + 10,
                    totalUsers: Math.floor(Math.random() * 1000) + 100
                })),
                retentionTrend: this.generateTrendData(startDate, endDate, 'retention')
            },
            updates: {
                adoptionRate: 0.67,
                updateAdoptionByVersion: [
                    { version: '1.2.0', adoptionRate: 0.85, totalUsers: 450 },
                    { version: '1.1.5', adoptionRate: 0.72, totalUsers: 380 },
                    { version: '1.1.0', adoptionRate: 0.58, totalUsers: 320 },
                    { version: '1.0.5', adoptionRate: 0.45, totalUsers: 280 }
                ],
                updateTrend: this.generateTrendData(startDate, endDate, 'updates')
            },
            comparative: {
                downloadsVsPlatform: {
                    yourDownloads: modpacks.length * Math.floor(Math.random() * 500) + 1000,
                    platformAverage: 2500,
                    percentile: 78
                },
                retentionVsPlatform: {
                    yourRetention: 14.5,
                    platformAverage: 12.3,
                    percentile: 82
                },
                updateAdoptionVsPlatform: {
                    yourAdoption: 0.67,
                    platformAverage: 0.55,
                    percentile: 75
                }
            }
        };

        return c.json({
            success: true,
            data: analyticsData
        });
    }

    private static generateTrendData(startDate: Date, endDate: Date, type: 'retention' | 'updates'): any[] {
        const data = [];
        const currentDate = new Date(startDate);

        while (currentDate <= endDate) {
            if (type === 'retention') {
                data.push({
                    date: currentDate.toISOString().split('T')[0],
                    averageRetention: Math.random() * 5 + 10 + Math.sin(data.length * 0.1) * 2
                });
            } else {
                data.push({
                    date: currentDate.toISOString().split('T')[0],
                    updatesAdopted: Math.floor(Math.random() * 50) + 20,
                    totalAvailable: Math.floor(Math.random() * 20) + 80
                });
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }

        return data;
    }
}