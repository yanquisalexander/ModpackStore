import { db } from "@/db/client.ts";
import { users, UserRole } from "@/db/schema.ts";
import { eq } from "drizzle-orm";

export interface UserFlags {
    max_instances_allowed: number;
    ad_free: boolean;
    can_upload_cover_image: boolean;
    priority_support: boolean;
    early_access_features: boolean;
    custom_badges: boolean;
    server_priority_queue: boolean;
    custom_instance_icons: boolean;
    allow_mod_manager: boolean;
    enable_instance_mod_downloader: boolean;
}

export const DEFAULT_USER_FLAGS: UserFlags = {
    max_instances_allowed: 10,
    ad_free: false,
    can_upload_cover_image: false,
    priority_support: false,
    early_access_features: false,
    custom_badges: false,
    server_priority_queue: false,
    custom_instance_icons: false,
    allow_mod_manager: false,
    enable_instance_mod_downloader: false,
};

export const PLUS_USER_FLAGS: UserFlags = {
    max_instances_allowed: 100,
    ad_free: true,
    can_upload_cover_image: true,
    priority_support: true,
    early_access_features: true,
    custom_badges: true,
    server_priority_queue: true,
    custom_instance_icons: true,
    allow_mod_manager: true,
    enable_instance_mod_downloader: true,
};

export async function getUserFlags(userId: string): Promise<UserFlags> {
    try {
        const [user] = await db
            .select({
                id: users.id,
                role: users.role,
                patreonId: users.patreonId,
                patreonAccessToken: users.patreonAccessToken,
                isPlus: users.isPlus,
                adFree: users.adFree,
            })
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);

        if (!user) {
            return DEFAULT_USER_FLAGS;
        }

        // Admins, Super Admins, Explicit Plus members, or active Patreon supporters
        const isAdmin = user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;
        const hasActivePatreon = Boolean(user.patreonId && user.patreonAccessToken);
        const isPlus = Boolean(user.isPlus) || isAdmin || hasActivePatreon;

        if (isPlus) {
            return {
                ...PLUS_USER_FLAGS,
                ad_free: true,
            };
        }

        // User might have ad_free granted individually even without full plus
        return {
            ...DEFAULT_USER_FLAGS,
            ad_free: Boolean(user.adFree),
        };
    } catch (error) {
        console.error("[USER_FLAGS_SERVICE] Error fetching flags for user:", userId, error);
        return DEFAULT_USER_FLAGS;
    }
}
