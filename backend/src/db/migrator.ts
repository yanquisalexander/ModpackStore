import "dotenv/config";
import { client, pool } from "./client";
import { resolve } from "node:path";
import { migrate } from "drizzle-orm/postgres-js/migrator";

const __dirname = resolve();

export const migrateDatabase = async () => {
    await migrate(client, {
        migrationsFolder: resolve(__dirname, "./src/db/migrations"),
    });

    console.log("Database migrated successfully");
};

/* 
  If executed as a script, this file will migrate the database. (ECMAScript module)
  Remember: require() is not available in ES modules.
*/

if (require.main === module) {
    migrateDatabase()
        .then(() => {
            console.log("Migration completed successfully");
            pool.end();
        })
        .catch((error) => {
            console.error("Migration failed:", error);
            pool.end();
        });
}