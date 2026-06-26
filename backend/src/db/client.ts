import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";

import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import pg from "pg";

const isDev = Deno.env.get("ENVIRONMENT") === "development";
// o Deno.env.get("NODE_ENV") === "development"

export const db = isDev
    ? drizzlePg(
        new pg.Pool({
            connectionString: Deno.env.get("DATABASE_URL"),
        })
    )
    : drizzle(neon(Deno.env.get("DATABASE_URL")!));