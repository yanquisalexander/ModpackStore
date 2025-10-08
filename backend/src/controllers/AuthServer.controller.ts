import { Context } from 'hono';
import { AuthServerService } from '@/services/authserver.service';
import { APIError } from '@/lib/APIError';

/**
 * AuthServer Controller
 * Handles Yggdrasil protocol endpoints for authlib-injector compatibility
 */
export class AuthServerController {
    
    /**
     * POST /authserver/authenticate
     * Authenticate with ModpackStore JWT token and create game session
     */
    static async authenticate(c: Context) {
        try {
            const body = await c.req.json();
            
            // Extract parameters from request
            // For ModpackStore, we use JWT token instead of username/password
            const { token, clientToken, agent } = body;

            if (!token) {
                throw new APIError(400, 'Token is required');
            }

            const response = await AuthServerService.authenticate(
                token,
                clientToken,
                agent?.name,
                agent?.version
            );

            return c.json(response);
        } catch (error) {
            if (error instanceof APIError) {
                return c.json({
                    error: 'ForbiddenOperationException',
                    errorMessage: error.message
                }, error.statusCode);
            }
            console.error('[AuthServerController] Authenticate error:', error);
            return c.json({
                error: 'ForbiddenOperationException',
                errorMessage: 'Invalid credentials'
            }, 403);
        }
    }

    /**
     * POST /authserver/refresh
     * Refresh access token
     */
    static async refresh(c: Context) {
        try {
            const body = await c.req.json();
            const { accessToken, clientToken } = body;

            if (!accessToken || !clientToken) {
                throw new APIError(400, 'Access token and client token are required');
            }

            const response = await AuthServerService.refresh(accessToken, clientToken);

            return c.json(response);
        } catch (error) {
            if (error instanceof APIError) {
                return c.json({
                    error: 'ForbiddenOperationException',
                    errorMessage: error.message
                }, error.statusCode);
            }
            console.error('[AuthServerController] Refresh error:', error);
            return c.json({
                error: 'ForbiddenOperationException',
                errorMessage: 'Invalid token'
            }, 403);
        }
    }

    /**
     * POST /authserver/validate
     * Validate access token
     */
    static async validate(c: Context) {
        try {
            const body = await c.req.json();
            const { accessToken, clientToken } = body;

            if (!accessToken) {
                throw new APIError(400, 'Access token is required');
            }

            await AuthServerService.validate(accessToken, clientToken);

            // Yggdrasil protocol: return 204 No Content on success
            return c.body(null, 204);
        } catch (error) {
            if (error instanceof APIError) {
                return c.json({
                    error: 'ForbiddenOperationException',
                    errorMessage: error.message
                }, error.statusCode);
            }
            console.error('[AuthServerController] Validate error:', error);
            return c.json({
                error: 'ForbiddenOperationException',
                errorMessage: 'Invalid token'
            }, 403);
        }
    }

    /**
     * POST /authserver/invalidate
     * Invalidate access token (logout)
     */
    static async invalidate(c: Context) {
        try {
            const body = await c.req.json();
            const { accessToken, clientToken } = body;

            if (!accessToken || !clientToken) {
                throw new APIError(400, 'Access token and client token are required');
            }

            await AuthServerService.invalidate(accessToken, clientToken);

            // Yggdrasil protocol: return 204 No Content on success
            return c.body(null, 204);
        } catch (error) {
            if (error instanceof APIError) {
                return c.json({
                    error: 'ForbiddenOperationException',
                    errorMessage: error.message
                }, error.statusCode);
            }
            console.error('[AuthServerController] Invalidate error:', error);
            return c.json({
                error: 'ForbiddenOperationException',
                errorMessage: 'Invalid token'
            }, 403);
        }
    }

    /**
     * POST /authserver/signout
     * Sign out all sessions
     */
    static async signout(c: Context) {
        try {
            const body = await c.req.json();
            const { token } = body;

            if (!token) {
                throw new APIError(400, 'Token is required');
            }

            await AuthServerService.signout(token);

            // Yggdrasil protocol: return 204 No Content on success
            return c.body(null, 204);
        } catch (error) {
            // Always succeed for signout (Yggdrasil behavior)
            return c.body(null, 204);
        }
    }

    /**
     * GET / (root metadata endpoint)
     * Return authlib-injector metadata
     */
    static async getMetadata(c: Context) {
        try {
            const metadata = await AuthServerService.getMetadata();
            return c.json(metadata);
        } catch (error) {
            console.error('[AuthServerController] Metadata error:', error);
            return c.json({
                error: 'InternalError',
                errorMessage: 'Failed to retrieve metadata'
            }, 500);
        }
    }

    /**
     * POST /authserver/gamesession
     * Convenience endpoint for Rust launcher to get/create game session
     * This is NOT part of the Yggdrasil protocol - it's a custom extension
     */
    static async getGameSession(c: Context) {
        try {
            const body = await c.req.json();
            const { token, nickname } = body;

            if (!token) {
                throw new APIError(400, 'Token is required');
            }

            const session = await AuthServerService.getOrCreateGameSession(token, nickname);

            return c.json({
                data: session
            });
        } catch (error) {
            if (error instanceof APIError) {
                return c.json({
                    error: error.message
                }, error.statusCode);
            }
            console.error('[AuthServerController] GetGameSession error:', error);
            return c.json({
                error: 'Failed to create game session'
            }, 500);
        }
    }
}
