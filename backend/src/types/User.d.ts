import { Request } from "express";
declare module "express" {
    interface Request {
        user?: {
            id: string;
            username: string;
            email: string;
            createdAt: Date;
            updatedAt: Date;
            discordId: string;
            discordAccessToken: string;
            discordRefreshToken: string;
            patreonId: string | null;
            patreonAccessToken: string | null;
            patreonRefreshToken: string | null;
            session: {
                id: number;
                userId: string;
                deviceInfo: Record<string, any>;
                locationInfo: Record<string, any>;
                createdAt: Date;
                updatedAt: Date;
            };
            is_patron: boolean;
        };
    }
}
