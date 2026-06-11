import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

const pool = new pg.Pool({
    connectionString: Deno.env.get("DATABASE_URL"),
});

export const db = drizzle(pool);
