import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";

const useNeon = Deno.env.get("DB_DRIVER") === "neon";

// Cold-start: en serverless (neon) nunca cargamos `pg` ni `node-postgres`.
// El branch local hace dynamic import para no penalizar a Deploy.
// Top-level await es soportado por Deno.
export const db = useNeon
    ? drizzleNeon(neon(Deno.env.get("DATABASE_URL")!))
    : (await import("drizzle-orm/node-postgres").then(async ({ drizzle: drizzlePg }) => {
        const { default: pg } = await import("pg");
        return drizzlePg(
            new pg.Pool({
                connectionString: Deno.env.get("DATABASE_URL"),
            }),
        );
    }));
