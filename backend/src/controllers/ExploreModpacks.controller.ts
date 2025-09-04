import { type Context } from 'hono';
import { getExploreModpacks, getModpackById, searchModpacks } from "@/services/modpacks";
import { serializeCollection, serializeResource, serializeError } from "../utils/jsonapi";
import { ModpackVersion } from "@/entities/ModpackVersion";
import { ModpackVersionStatus } from "@/types/enums";
import { DOWNLOAD_PREFIX_URL } from "@/services/r2UploadService";
import { Modpack } from "@/entities/Modpack";
import { tryParseJSON } from "@/utils/tryParseJSON";
import { TwitchService } from "@/services/twitch.service";
import { ModpackAccessService } from "@/services/modpack-access.service";
import { AuthVariables } from "@/middlewares/auth.middleware";

export class ExploreModpacksController {
    static async getHomepage(c: Context): Promise<Response> {
        try {
            const modpacks = await getExploreModpacks(); // Assuming this returns an array of modpacks
            return c.json(serializeCollection('modpack', modpacks), 200);
        } catch (error: any) {
            console.error("[CONTROLLER_EXPLORE] Error in getHomepage:", error);
            const statusCode = error.statusCode || 500;
            return c.json(serializeError({
                status: statusCode.toString(),
                title: error.name || 'Homepage Error',
                detail: error.message || "Failed to fetch homepage modpacks."
            }), statusCode);
        }
    }

    static async search(c: Context): Promise<Response> {
        const q = c.req.query('q');

        if (!q) {
            return c.json(serializeError({
                status: '400',
                title: 'Bad Request',
                detail: 'Missing search query parameter (q).',
            }), 400);
        }

        if (typeof q !== 'string' || q.length < 3) {
            return c.json(serializeError({
                status: '400',
                title: 'Bad Request',
                detail: 'Search query (q) must be a string of at least 3 characters.',
            }), 400);
        }

        try {
            const modpacks = await searchModpacks(q); // Service should handle toString() or type checking
            return c.json(serializeCollection('modpack', modpacks), 200);
        } catch (error: any) {
            console.error("[CONTROLLER_EXPLORE] Error in search:", error);
            const statusCode = error.statusCode || 500;
            return c.json(serializeError({
                status: statusCode.toString(),
                title: error.name || 'Search Error',
                detail: error.message || "Failed to search modpacks."
            }), statusCode);
        }
    }

    static async getModpack(c: Context): Promise<Response> {
        const modpackId = c.req.param('modpackId');

        // modpackId is guaranteed by the route, no need to check for its existence here.

        try {
            const modpack = await getModpackById(modpackId);
            if (!modpack) {
                return c.json(serializeError({
                    status: '404',
                    title: 'Not Found',
                    detail: "Modpack not found.",
                }), 404);
            }
            return c.json(serializeResource('modpack', modpack), 200);
        } catch (error: any) {
            console.error(`[CONTROLLER_EXPLORE] Error in getModpack for ID ${modpackId}:`, error);
            const statusCode = error.statusCode || 500;
            return c.json(serializeError({
                status: statusCode.toString(),
                title: error.name || 'Modpack Error',
                detail: error.message || "Failed to fetch modpack details."
            }), statusCode);
        }
    }

    static async getPrelaunchAppearance(c: Context): Promise<Response> {
        const modpackId = c.req.param('modpackId');

        try {
            const modpack = await getModpackById(modpackId);
            if (!modpack) {
                return c.json(serializeError({
                    status: '404',
                    title: 'Not Found',
                    detail: "Modpack not found.",
                }), 404);
            }

            let attributes = tryParseJSON(modpack.prelaunchAppearance);

            // Return the prelaunch appearance or null if not set
            return c.json({
                data: {
                    type: 'prelaunch-appearance',
                    id: modpackId,
                    attributes: attributes || null
                }
            }, 200);
        } catch (error: any) {
            console.error(`[CONTROLLER_EXPLORE] Error in getPrelaunchAppearance for ID ${modpackId}:`, error);
            const statusCode = error.statusCode || 500;
            return c.json(serializeError({
                status: statusCode.toString(),
                title: error.name || 'Prelaunch Appearance Error',
                detail: error.message || "Failed to fetch prelaunch appearance."
            }), statusCode);
        }
    }

    static async getModpackVersions(c: Context): Promise<Response> {
        const modpackId = c.req.param('modpackId');

        try {
            const versions = await ModpackVersion.find({
                where: { modpackId, status: ModpackVersionStatus.PUBLISHED },
                relations: ['files', 'files.file'],
                select: {
                    id: true,
                    changelog: true,
                    mcVersion: true,
                    forgeVersion: true,
                    releaseDate: true,
                    status: true,

                    version: true,
                    files: {
                        path: true,
                        file: {
                            type: true
                        }
                    }
                }
            });
            return c.json(serializeCollection('modpackVersion', versions), 200);
        } catch (error: any) {
            console.error(`[CONTROLLER_EXPLORE] Error in getModpackVersions for ID ${modpackId}:`, error);
            const statusCode = error.statusCode || 500;
            return c.json(serializeError({
                status: statusCode.toString(),
                title: error.name || 'Modpack Versions Error',
                detail: error.message || "Failed to fetch modpack versions."
            }), statusCode);
        }
    }

    static async getModpackVersionManifest(c: Context): Promise<Response> {
        const modpackId = c.req.param('modpackId');
        const versionId = c.req.param('versionId');

        const IS_LATEST_REQUESTED = versionId.toLowerCase() === 'latest';


        try {
            const whereCondition = IS_LATEST_REQUESTED
                ? { modpackId, status: ModpackVersionStatus.PUBLISHED }
                : { id: versionId, modpackId };

            const mpVersion = await ModpackVersion.findOne({
                where: whereCondition,
                relations: ['files', 'files.file'],
                select: {
                    id: true,
                    changelog: true,
                    mcVersion: true,
                    forgeVersion: true,
                    releaseDate: true,
                    status: true,
                    version: true,
                    files: {
                        path: true,
                        fileHash: true,
                        file: {
                            type: true,
                            size: true,
                        }
                    }
                },
                order: IS_LATEST_REQUESTED ? { releaseDate: 'DESC' } : undefined,
            });
            if (!mpVersion) {
                return c.json(serializeError({
                    status: '404',
                    title: 'Not Found',
                    detail: "Modpack version not found.",
                }), 404);
            }

            // Generar manifiesto con URLs de descarga
            const getDownloadUrl = (hash: string) => new URL(`${hash.slice(0, 2)}/${hash.slice(2, 4)}/${hash}`, DOWNLOAD_PREFIX_URL).toString();
            const manifest = {
                ...mpVersion,
                files: mpVersion.files.map(file => ({
                    ...file,
                    downloadUrl: getDownloadUrl(file.fileHash)
                }))
            };

            return c.json({ manifest }, 200);
        } catch (error: any) {
            console.error(`[CONTROLLER_EXPLORE] Error in getModpackVersionManifest for ID ${modpackId} and Version ${versionId}:`, error);
            const statusCode = error.statusCode || 500;
            return c.json(serializeError({
                status: statusCode.toString(),
                title: error.name || 'Modpack Version Error',
                detail: error.message || "Failed to fetch modpack version."
            }), statusCode);
        }
    }

    static async getLatestVersion(c: Context): Promise<Response> {
        const modpackId = c.req.param('modpackId');

        try {
            const latestVersion = await ModpackVersion.findOne({
                where: {
                    modpackId,
                    status: ModpackVersionStatus.PUBLISHED
                },
                relations: ["modpack"],
                order: { releaseDate: "DESC" }
            });

            if (!latestVersion) {
                return c.json(serializeError({
                    status: '404',
                    title: 'Not Found',
                    detail: "No published version found for this modpack.",
                }), 404);
            }

            return c.json({
                version: {
                    id: latestVersion.id,
                    version: latestVersion.version,
                    mcVersion: latestVersion.mcVersion,
                    forgeVersion: latestVersion.forgeVersion,
                    releaseDate: latestVersion.releaseDate,
                    modpack: {
                        id: latestVersion.modpack.id,
                        name: latestVersion.modpack.name
                    }
                }
            }, 200);
        } catch (error: any) {
            console.error(`[CONTROLLER_EXPLORE] Error in getLatestVersion for ID ${modpackId}:`, error);
            const statusCode = error.statusCode || 500;
            return c.json(serializeError({
                status: statusCode.toString(),
                title: error.name || 'Latest Version Error',
                detail: error.message || "Failed to fetch latest version."
            }), statusCode);
        }
    }

    static async checkForUpdates(c: Context): Promise<Response> {
        const modpackId = c.req.param('modpackId');
        const currentVersion = c.req.query('currentVersion');

        if (!currentVersion) {
            return c.json(serializeError({
                status: '400',
                title: 'Bad Request',
                detail: 'Missing currentVersion query parameter.',
            }), 400);
        }

        try {
            const latestVersion = await ModpackVersion.findOne({
                where: {
                    modpackId,
                    status: ModpackVersionStatus.PUBLISHED
                },
                relations: ["modpack"],
                order: { releaseDate: "DESC" }
            });

            if (!latestVersion) {
                return c.json(serializeError({
                    status: '404',
                    title: 'Not Found',
                    detail: "No published version found for this modpack.",
                }), 404);
            }

            const hasUpdate = latestVersion.version !== currentVersion;

            return c.json({
                hasUpdate,
                currentVersion,
                latestVersion: {
                    id: latestVersion.id,
                    version: latestVersion.version,
                    mcVersion: latestVersion.mcVersion,
                    forgeVersion: latestVersion.forgeVersion,
                    releaseDate: latestVersion.releaseDate,
                    changelog: latestVersion.changelog
                },
                modpack: {
                    id: latestVersion.modpack.id,
                    name: latestVersion.modpack.name
                }
            }, 200);
        } catch (error: any) {
            console.error(`[CONTROLLER_EXPLORE] Error in checkForUpdates for ID ${modpackId}:`, error);
            const statusCode = error.statusCode || 500;
            return c.json(serializeError({
                status: statusCode.toString(),
                title: error.name || 'Check Update Error',
                detail: error.message || "Failed to check for updates."
            }), statusCode);
        }
    }

    static async validateModpackPassword(c: Context): Promise<Response> {
        const modpackId = c.req.param('modpackId');
        const { password } = await c.req.json();

        if (!password) {
            return c.json(serializeError({
                status: '400',
                title: 'Bad Request',
                detail: 'Password is required.',
            }), 400);
        }

        try {
            const modpack = await Modpack.findOne({
                where: { id: modpackId }
            });

            if (!modpack) {
                return c.json(serializeError({
                    status: '404',
                    title: 'Not Found',
                    detail: "Modpack not found.",
                }), 404);
            }

            console.log(`[CONTROLLER_EXPLORE] Validating password for modpack ID ${modpackId}`);

            console.log(`[CONTROLLER_EXPLORE] Modpack password: ${modpack.password}, Provided password: ${password}`);

            // Check if modpack requires password
            if (!modpack.password) {
                return c.json({
                    valid: true,
                    message: "Modpack does not require password."
                }, 200);
            }

            // Validate password
            const isValid = modpack.password === password;

            return c.json({
                valid: isValid,
                message: isValid ? "Password is correct." : "Invalid password."
            }, 200);

        } catch (error: any) {
            console.error(`[CONTROLLER_EXPLORE] Error in validateModpackPassword for ID ${modpackId}:`, error);
            const statusCode = error.statusCode || 500;
            return c.json(serializeError({
                status: statusCode.toString(),
                title: error.name || 'Password Validation Error',
                detail: error.message || "Failed to validate password."
            }), statusCode);
        }
    }

    static async getTwitchChannelInfo(c: Context): Promise<Response> {
        const { channelIds } = await c.req.json();

        if (!Array.isArray(channelIds) || channelIds.length === 0) {
            return c.json(serializeError({
                status: '400',
                title: 'Bad Request',
                detail: 'channelIds must be a non-empty array.',
            }), 400);
        }

        try {
            const apiClient = await TwitchService.getAppApiClient();
            const channelInfo = [];

            for (const channelId of channelIds) {
                try {
                    const user = await apiClient.users.getUserById(channelId);
                    if (user) {
                        channelInfo.push({
                            id: user.id,
                            username: user.name,
                            displayName: user.displayName,
                            profileImageUrl: user.profilePictureUrl,
                            isLive: false // Could be enhanced to check stream status
                        });
                    }
                } catch (error) {
                    console.log(`Channel ${channelId} not found or error fetching info:`, error);
                    // Add basic info for channels that can't be fetched
                    channelInfo.push({
                        id: channelId,
                        username: channelId,
                        displayName: channelId,
                        profileImageUrl: null,
                        isLive: false
                    });
                }
            }

            return c.json({
                data: channelInfo
            }, 200);
        } catch (error: any) {
            console.error('[CONTROLLER_EXPLORE] Error in getTwitchChannelInfo:', error);
            const statusCode = error.statusCode || 500;
            return c.json(serializeError({
                status: statusCode.toString(),
                title: error.name || 'Twitch Channel Info Error',
                detail: error.message || "Failed to fetch Twitch channel information."
            }), statusCode);
        }
    }

    static async getUserTwitchSubscriptions(c: Context): Promise<Response> {
        try {
            // Get authenticated user
            const user = c.get('user');
            if (!user || !user.hasTwitchLinked()) {
                return c.json(serializeError({
                    status: '403',
                    title: 'Forbidden',
                    detail: 'User must have Twitch account linked.',
                }), 403);
            }

            const { channelIds } = await c.req.json();
            if (!Array.isArray(channelIds)) {
                return c.json(serializeError({
                    status: '400',
                    title: 'Bad Request',
                    detail: 'channelIds must be an array.',
                }), 400);
            }

            // Check subscriptions using the Twitch service
            const hasAccess = await TwitchService.canUserAccessModpack(user, channelIds);

            if (!hasAccess) {
                return c.json({
                    hasAccess: false,
                    subscribedChannels: []
                }, 200);
            }

            // If user has access, we need to determine which specific channels they're subscribed to
            // Using batch API call for better performance
            const apiClient = await TwitchService.getUserApiClient(
                user.id,
                user.twitchAccessToken!,
                user.twitchRefreshToken || undefined
            );

            const subscribedChannels = [];

            // Check subscriptions for each channel using the more direct method
            for (const channelId of channelIds) {
                try {
                    // Check if user is subscribed to this broadcaster
                    const subscription = await apiClient.subscriptions.checkUserSubscription(user.twitchId!, channelId);

                    if (subscription) {
                        // User is subscribed to this channel
                        const channelUser = await apiClient.users.getUserById(channelId);
                        if (channelUser) {
                            subscribedChannels.push({
                                id: channelUser.id,
                                username: channelUser.name,
                                displayName: channelUser.displayName,
                                profileImageUrl: channelUser.profilePictureUrl,
                                isLive: false // Could be enhanced to check stream status
                            });
                        }
                    }
                } catch (error) {
                    console.log(`Error checking subscription for channel ${channelId}:`, error);
                    // Continue to next channel
                }
            }

            return c.json({
                hasAccess: true,
                subscribedChannels
            }, 200);
        } catch (error: any) {
            console.error('[CONTROLLER_EXPLORE] Error in getUserTwitchSubscriptions:', error);
            const statusCode = error.statusCode || 500;
            return c.json(serializeError({
                status: statusCode.toString(),
                title: error.name || 'Twitch User Subscriptions Error',
                detail: error.message || "Failed to fetch Twitch user subscriptions."
            }), statusCode);
        }
    }

    static async checkUserModpackAccess(c: Context<{ Variables: Partial<AuthVariables> }>): Promise<Response> {
        const modpackId = c.req.param('modpackId');

        try {
            // Get the modpack entity instance to access its methods
            const modpack = await Modpack.findOne({
                where: { id: modpackId },
                relations: ["creatorUser", "publisher"]
            });

            if (!modpack) {
                return c.json(serializeError({
                    status: '404',
                    title: 'Not Found',
                    detail: "Modpack not found.",
                }), 404);
            }

            // Get authenticated user if available
            const user = c.get('user') || null;

            // Check access using the ModpackAccessService
            const accessResult = await ModpackAccessService.canUserAccessModpack(user, modpack);

            return c.json({
                canAccess: accessResult.canAccess,
                reason: accessResult.reason,
                requiredChannels: accessResult.requiredChannels,
                modpackAccessInfo: ModpackAccessService.getModpackAccessInfo(modpack)
            }, 200);
        } catch (error: any) {
            console.error(`[CONTROLLER_EXPLORE] Error in checkUserModpackAccess for ID ${modpackId}:`, error);
            const statusCode = error.statusCode || 500;
            return c.json(serializeError({
                status: statusCode.toString(),
                title: error.name || 'Access Check Error',
                detail: error.message || "Failed to check user access to modpack."
            }), statusCode);
        }
    }
}
