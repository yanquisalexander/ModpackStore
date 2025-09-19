import { z } from "zod";
import { PublisherMemberRole } from "../types/enums";

export const newPublisherSchema = z.object({
    publisherName: z.string().min(1).max(32),
    tosUrl: z.string().url(),
    privacyUrl: z.string().url(),
    bannerUrl: z.string().url(),
    logoUrl: z.string().url(),
    description: z.string().min(1),
    websiteUrl: z.string().url().optional(),
    discordUrl: z.string().url().optional(),
    banned: z.boolean().default(false),
    verified: z.boolean().default(false),
    partnered: z.boolean().default(false),
    isHostingPartner: z.boolean().default(false),
});

export const publisherUpdateSchema = newPublisherSchema.partial();

export const publisherMemberSchema = z.object({
    publisherId: z.string().uuid(),
    userId: z.string().uuid(),
    role: z.nativeEnum(PublisherMemberRole),
});

// Updated scope schema with granular permissions
export const scopeSchema = z.object({
    publisherId: z.string().uuid().optional(),
    modpackId: z.string().uuid().optional(),
    // Granular modpack permissions
    modpackView: z.boolean().default(false),
    modpackModify: z.boolean().default(false),
    modpackManageVersions: z.boolean().default(false),
    modpackPublish: z.boolean().default(false),
    modpackDelete: z.boolean().default(false),
    modpackManageAccess: z.boolean().default(false),
    // Publisher-level permissions
    publisherManageCategoriesTags: z.boolean().default(false),
    publisherViewStats: z.boolean().default(false),
    // Legacy permissions for backward compatibility
    canCreateModpacks: z.boolean().default(false),
    canEditModpacks: z.boolean().default(false),
    canDeleteModpacks: z.boolean().default(false),
    canPublishVersions: z.boolean().default(false),
    canManageMembers: z.boolean().default(false),
    canManageSettings: z.boolean().default(false),
}).refine(data => data.publisherId || data.modpackId, {
    message: "Either publisherId or modpackId must be provided"
});

export const updateMemberPermissionsSchema = z.object({
    scopes: z.array(scopeSchema),
});

export const assignPermissionSchema = z.object({
    userId: z.string().uuid(),
    permission: z.enum([
        'modpack.view',
        'modpack.modify', 
        'modpack.manage_versions',
        'modpack.publish',
        'modpack.delete',
        'modpack.manage_access',
        'publisher.manage_categories_tags',
        'publisher.view_stats'
    ]),
    modpackId: z.string().uuid().optional(),
    enable: z.boolean()
});