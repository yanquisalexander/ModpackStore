import { Hono } from "@hono/hono";
import { cors } from "@hono/hono/cors";
import { SERVER_START_TIME } from "@/constants.ts";
import { APIError } from "@/lib/APIError.ts";
import v1Router from "@/v1/index.ts";

const IS_SERVERLESS = Deno.env.get("SERVERLESS_ENVIRONMENT") === "true";

const PORT = Number(Deno.env.get("PORT")) || 3000;
const app = new Hono();

const SHOULD_INIT_WORKER = Deno.args.includes("--worker-mode");

if (SHOULD_INIT_WORKER) {
    // If the --worker-mode flag is passed, we initialize in worker mode
    // So, we DON'T start the server, we just initialize the worker

    await import("./worker/worker-index.ts").then(({ initWorker }) => initWorker());
} else {
    app.use("*", cors({
        origin: Deno.env.get("CORS_ORIGIN") || "*",
        allowHeaders: ["Content-Type", "Authorization", "x-hcaptcha-response"],
        allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    }));

    app.use("*", async (c, next) => {
        const start = Date.now();
        const res = await next();
        const duration = Date.now() - start;
        console.log(`[${c.req.method}] ${c.req.url} - ${duration}ms`);
        return res;
    });

    app.use("*", (c, next) => {
        // Add X-Server: Modpack Store header to all responses
        c.res.headers.set("X-Server", "Modpack Store");
        return next();
    });

    app.route("/v1", v1Router);

    if (!IS_SERVERLESS) {
        app.get("/job", async (c) => {
            const { ProcessModpackFilesQueue } = await import("@/worker/queues.ts");
            await ProcessModpackFilesQueue.add("process-modpack-files", {}, { jobId: `job-${Date.now()}` });
            return c.json({ ok: true });
        });
    }

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

        const detail = Deno.env.get("ENV") === "development"
            ? err.message
            : "An unexpected error occurred";

        return c.json(
            {
                errors: [
                    {
                        status: "500",
                        code: "INTERNAL_SERVER_ERROR",
                        title: "Internal Server Error",
                        detail,
                    },
                ],
            },
            500,
        );
    });

    if (!IS_SERVERLESS) {
        const { generateSystemUser, seedDefaultCategories, seedDefaultHouseAds } = await import("@/db/seed.ts");

        await generateSystemUser().catch((error) => {
            console.error("Error generating system user:", error);
        });

        await seedDefaultCategories().catch((error) => {
            console.error("Error seeding default categories:", error);
        });

        await seedDefaultHouseAds().catch((error) => {
            console.error("Error seeding default house ads:", error);
        });
    }

    Deno.serve({ port: PORT }, app.fetch);
}