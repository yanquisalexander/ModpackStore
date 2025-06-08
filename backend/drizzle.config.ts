import type { Config } from "drizzle-kit";

export default {
    schema: "./src/db/schema.ts",
    out: "./src/db/migrations",
    verbose: true,
    dialect: "postgresql",
    dbCredentials: {
        host: process.env.DB_HOST || "localhost",
        port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 5432,
        user: process.env.DB_USER || "postgres",
        password: process.env.DB_PASSWORD || "postgres",
        database: process.env.DB_NAME || "postgres",
    },
} satisfies Config;