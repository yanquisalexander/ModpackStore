import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import pg from "pg";

const useNeon = Deno.env.get("DB_DRIVER") === "neon";

export const db = useNeon
    ? drizzleNeon(neon(Deno.env.get("DATABASE_URL")!))
    : drizzlePg(
        new pg.Pool({
            connectionString: Deno.env.get("DATABASE_URL"),
        })
    );
