// src/types/User.ts

export interface Session {
    id: number;
    userId: string;
    deviceInfo: Record<string, any>;
    locationInfo: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}

export interface User {
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
    session: Session;
    is_patron: boolean;
}

// Ejemplo de uso en Hono:
import type { Context } from 'hono';

export type UserContext = {
    Variables: {
        user?: User;
    };
};
