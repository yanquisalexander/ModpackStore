import type { Context, Next } from "@hono/hono";
import type { AuthVariables } from "@/auth/middleware.ts";
import { checkAccess } from "@/services/acquisition.service.ts";
import { ForbiddenError } from "@/lib/errors/index.ts";

export async function requireModpackAccess(c: Context<{ Variables: AuthVariables }>, next: Next) {
    const userId = c.get("userId");
    const modpackId = c.req.param("modpackId")!;

    const { hasAccess, reason } = await checkAccess(userId, modpackId);

    if (!hasAccess) {
        throw new ForbiddenError(
            reason ?? "You need to acquire this modpack to access its content.",
            "ACCESS_DENIED",
        );
    }

    await next();
}
