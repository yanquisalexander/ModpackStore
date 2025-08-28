"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.migrateDatabase = void 0;
require("dotenv/config");
const client_1 = require("./client");
const node_path_1 = require("node:path");
const migrator_1 = require("drizzle-orm/postgres-js/migrator");
const __dirname = (0, node_path_1.resolve)();
const migrateDatabase = () => __awaiter(void 0, void 0, void 0, function* () {
    yield (0, migrator_1.migrate)(client_1.client, {
        migrationsFolder: (0, node_path_1.resolve)(__dirname, "./src/db/migrations"),
    });
    console.log("Database migrated successfully");
});
exports.migrateDatabase = migrateDatabase;
/*
  If executed as a script, this file will migrate the database. (ECMAScript module)
  Remember: require() is not available in ES modules.
*/
if (require.main === module) {
    (0, exports.migrateDatabase)()
        .then(() => {
        console.log("Migration completed successfully");
        client_1.pool.end();
    })
        .catch((error) => {
        console.error("Migration failed:", error);
        client_1.pool.end();
    });
}
