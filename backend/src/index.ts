import { Hono } from "@hono/hono";
import { cors } from "@hono/hono/cors";
import { SERVER_START_TIME } from "@/constants.ts";
import { APIError } from "@/lib/APIError.ts";
import v1Router from "@/v1/index.ts";

const PORT = Number(Deno.env.get("PORT")) || 3000;
const app = new Hono();

app.use("*", cors({
    origin: Deno.env.get("CORS_ORIGIN") || "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
}));

app.use("*", async (c, next) => {
    const start = Date.now();
    const res = await next();
    const duration = Date.now() - start;
    console.log(`[${c.req.method}] ${c.req.url} - ${duration}ms`);
    return res;
});

app.route("/v1", v1Router);

app.get("/health", (c) =>
    c.json({
        meta: {
            status: "ok",
            uptime_ms: Date.now() - SERVER_START_TIME,
        },
    }),
);

app.notFound((c) => c.body(null, 404));

app.onError((err, c) => {
    console.error("[GLOBAL_ERROR_HANDLER]", err);

    if (err instanceof APIError) {
        return c.json(err.toPayload(), (Number(err.statusCode) || 500) as any);
    }

    return c.json(
        {
            errors: [
                {
                    status: "500",
                    code: "INTERNAL_SERVER_ERROR",
                    title: "Internal Server Error",
                    detail: err.message,
                },
            ],
        },
        500,
    );
});

Deno.serve({ port: PORT }, app.fetch);
