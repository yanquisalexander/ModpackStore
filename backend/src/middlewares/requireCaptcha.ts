import type { Context, Next } from "@hono/hono";
import { ForbiddenError } from "@/lib/errors/index.ts";
import { verifyHCaptcha } from "@/services/hcaptcha.ts";

const HCAPTCHA_HEADER = "x-hcaptcha-response";

export async function requireCaptcha(c: Context, next: Next) {
    const token = c.req.header(HCAPTCHA_HEADER) ?? "";

    const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim()
        ?? c.req.header("x-real-ip")
        ?? undefined;

    const result = await verifyHCaptcha(token, ip);

    if (!result.success) {
        throw new ForbiddenError(
            "Captcha verification failed",
            "CAPTCHA_FAILED",
        );
    }

    await next();
}
