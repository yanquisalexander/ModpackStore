/**
 * ModpackStore CLI — Interactive REPL (Rails console style)
 *
 * Usage: deno task cli
 *
 * Examples:
 *   load user juan                    → loads user, stores as $_
 *   $_.username                       → "juan"
 *   $_.role = "admin"                 → sets role in memory
 *   save $_                           → persists to DB
 *   users                             → list all users
 *   u = user juan                     → stores as variable 'u'
 *   u.role = "super_admin"; save u    → update + save
 */

import { db } from "@/db/client.ts";
import {
    users,
    modpacksTable,
    creatorUsersTable,
    bansTable,
    creatorsTable,
    UserRole,
} from "@/db/schema.ts";
import { eq, ilike, or, sql, desc, count } from "drizzle-orm";

// ── Variable Store ──────────────────────────────────

const vars = new Map<string, Record<string, unknown>>();
const LAST_VAR = "$_";

function setVar(name: string, obj: Record<string, unknown>) {
    vars.set(name, obj);
}

function getVar(name: string): Record<string, unknown> | undefined {
    return vars.get(name);
}

function isVarName(s: string): boolean {
    return vars.has(s) || s === LAST_VAR;
}

// ── Loaders ─────────────────────────────────────────

interface Loader {
    findOne: (query: string) => Promise<Record<string, unknown> | null>;
    findMany: (args: string) => Promise<{ rows: Record<string, unknown>[]; total: number }>;
    tableName: string;
    saveFields: string[];
}

const loaders: Record<string, Loader> = {
    user: {
        tableName: "users",
        saveFields: ["username", "email", "role", "avatarUrl"],
        findOne: async (query) => {
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(query);
            const [row] = await db.select({
                id: users.id,
                username: users.username,
                email: users.email,
                role: users.role,
                avatarUrl: users.avatarUrl,
                discordId: users.discordId,
                twitchId: users.twitchId,
                twitchDisplayName: users.twitchDisplayName,
                createdAt: users.createdAt,
                updatedAt: users.updatedAt,
                lastLoginAt: users.lastLoginAt,
            })
                .from(users)
                .where(isUuid ? eq(users.id, query) : eq(users.username, query))
                .limit(1);
            return row ?? null;
        },
        findMany: async (args) => {
            const page = parseInt(args) || 1;
            const limit = 20;
            const offset = (page - 1) * limit;
            const rows = await db.select({
                id: users.id,
                username: users.username,
                email: users.email,
                role: users.role,
                createdAt: users.createdAt,
            }).from(users).orderBy(desc(users.createdAt)).limit(limit).offset(offset);
            const [{ total }] = await db.select({ total: count() }).from(users);
            return { rows, total: Number(total) };
        },
    },
    modpack: {
        tableName: "modpacks",
        saveFields: ["name", "visibility", "status"],
        findOne: async (query) => {
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(query);
            const [row] = await db.select().from(modpacksTable)
                .where(isUuid ? eq(modpacksTable.id, query) : eq(modpacksTable.slug, query))
                .limit(1);
            return row ?? null;
        },
        findMany: async (args) => {
            const page = parseInt(args) || 1;
            const limit = 20;
            const offset = (page - 1) * limit;
            const rows = await db.select({
                id: modpacksTable.id,
                name: modpacksTable.name,
                slug: modpacksTable.slug,
                visibility: modpacksTable.visibility,
                status: modpacksTable.status,
            }).from(modpacksTable).orderBy(desc(modpacksTable.createdAt)).limit(limit).offset(offset);
            const [{ total }] = await db.select({ total: count() }).from(modpacksTable);
            return { rows, total: Number(total) };
        },
    },
    creator: {
        tableName: "creators",
        saveFields: ["displayName", "status"],
        findOne: async (query) => {
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(query);
            const [row] = await db.select().from(creatorsTable)
                .where(isUuid ? eq(creatorsTable.id, query) : eq(creatorsTable.slug, query))
                .limit(1);
            return row ?? null;
        },
        findMany: async (args) => {
            const page = parseInt(args) || 1;
            const limit = 20;
            const offset = (page - 1) * limit;
            const rows = await db.select({
                id: creatorsTable.id,
                displayName: creatorsTable.displayName,
                slug: creatorsTable.slug,
                status: creatorsTable.status,
            }).from(creatorsTable).orderBy(desc(creatorsTable.createdAt)).limit(limit).offset(offset);
            const [{ total }] = await db.select({ total: count() }).from(creatorsTable);
            return { rows, total: Number(total) };
        },
    },
};

// ── Display ─────────────────────────────────────────

function printTable(rows: Record<string, unknown>[], columns?: string[]) {
    if (rows.length === 0) { console.log("  (empty)"); return; }
    const cols = columns || Object.keys(rows[0]);
    const widths: Record<string, number> = {};
    for (const col of cols) {
        widths[col] = col.length;
        for (const row of rows) {
            const val = String(row[col] ?? "");
            if (val.length > widths[col]) widths[col] = Math.min(val.length, 60);
        }
    }
    const header = cols.map((c) => c.padEnd(widths[c])).join("  ");
    const sep = cols.map((c) => "─".repeat(widths[c])).join("──");
    console.log(`  ${header}`);
    console.log(`  ${sep}`);
    for (const row of rows) {
        const line = cols.map((c) => {
            const val = String(row[c] ?? "");
            return val.length > 60 ? val.slice(0, 57) + "..." : val.padEnd(widths[c]);
        }).join("  ");
        console.log(`  ${line}`);
    }
}

function formatDate(d: Date | string | null): string {
    if (!d) return "-";
    return new Date(d).toISOString().slice(0, 19).replace("T", " ");
}

function printObject(obj: Record<string, unknown>) {
    const skip = ["discordAccessToken", "discordRefreshToken", "patreonAccessToken",
        "patreonRefreshToken", "twitchAccessToken", "twitchRefreshToken"];
    const keys = Object.keys(obj).filter((k) => !skip.includes(k));
    const maxLen = Math.max(...keys.map((k) => k.length));
    console.log("  {");
    for (const k of keys) {
        const v = obj[k];
        let display: string;
        if (v === null || v === undefined) display = "null";
        else if (v instanceof Date) display = formatDate(v);
        else if (typeof v === "string" && v.length > 80) display = `"${v.slice(0, 77)}..."`;
        else display = JSON.stringify(v);
        console.log(`    ${k.padEnd(maxLen + 1)} ${display},`);
    }
    console.log("  }");
}

// ── REPL ────────────────────────────────────────────

console.log(`
  ╔═════════════════════════════════════════════╗
  ║       ModpackStore CLI v1.0                 ║
  ║       Type "help" for commands              ║
  ╚═════════════════════════════════════════════╝

  Variables:
    $_              last loaded object
    u = user juan   store as 'u'
    u.role = "admin"  set property
    save u          persist to DB
`);

while (true) {
    const input = prompt("modpackstore >");
    if (input === null) break;

    const trimmed = input.trim();
    if (!trimmed) continue;

    try {
        await handleInput(trimmed);
    } catch (err) {
        console.error(`  Error: ${err}`);
    }
}

async function handleInput(input: string) {
    // ── help ──
    if (input === "help") {
        printHelp();
        return;
    }

    // ── exit / quit ──
    if (input === "exit" || input === "quit") {
        console.log("  Bye!");
        Deno.exit(0);
    }

    // ── vars (list variables) ──
    if (input === "vars") {
        if (vars.size === 0) {
            console.log("  (no variables)");
        } else {
            for (const [name, obj] of vars) {
                const desc = obj.username ?? obj.displayName ?? obj.name ?? obj.id ?? "?";
                console.log(`  ${name} = ${obj.constructor?.name ?? "Object"} (${desc})`);
            }
        }
        return;
    }

    // ── drop <var> ──
    if (input.startsWith("drop ")) {
        const varName = input.slice(5).trim();
        if (vars.delete(varName)) {
            console.log(`  Dropped ${varName}`);
        } else {
            console.log(`  Variable "${varName}" not found.`);
        }
        return;
    }

    // ── save <var> ──
    if (input.startsWith("save ")) {
        const varName = input.slice(5).trim();
        await handleSave(varName);
        return;
    }

    // ── sql <query> ──
    if (input.startsWith("sql ")) {
        const query = input.slice(4).trim();
        if (!query.toUpperCase().startsWith("SELECT")) {
            console.log("  Only SELECT queries are allowed.");
            return;
        }
        const result = await db.execute(sql.raw(query));
        const rows = result.rows as Record<string, unknown>[];
        if (rows.length === 0) { console.log("  (empty result)"); return; }
        console.log(`\n  ${rows.length} rows\n`);
        printTable(rows);
        console.log();
        return;
    }

    // ── health ──
    if (input === "health") {
        const start = Date.now();
        await db.execute(sql`SELECT 1`);
        console.log(`  ✅ Database connected (${Date.now() - start}ms)`);
        return;
    }

    // ── var.prop = value (assignment) ──
    const assignMatch = input.match(/^(\w+)\.(\w+)\s*=\s*(.+)$/);
    if (assignMatch) {
        const [, varName, prop, rawValue] = assignMatch;
        if (!isVarName(varName)) {
            console.log(`  Variable "${varName}" not found. Use: <var> = <class> <query>`);
            return;
        }
        const obj = getVar(varName);
        if (!obj) { console.log(`  Variable "${varName}" is empty.`); return; }
        const value = parseValue(rawValue);
        obj[prop] = value;
        console.log(`  ${varName}.${prop} = ${JSON.stringify(value)}`);
        return;
    }

    // ── var.prop (read) ──
    const readMatch = input.match(/^(\w+)\.(\w+)$/);
    if (readMatch) {
        const [, varName, prop] = readMatch;
        if (isVarName(varName)) {
            const obj = getVar(varName);
            if (obj) {
                const val = obj[prop];
                console.log(`  ${JSON.stringify(val)}`);
                return;
            }
        }
    }

    // ── var = class query (load & store) ──
    const loadMatch = input.match(/^(\w+)\s*=\s*(\w+)\s+(.+)$/);
    if (loadMatch) {
        const [, varName, className, query] = loadMatch;
        await handleLoad(varName, className, query);
        return;
    }

    // ── class query (load & display) ──
    const directMatch = input.match(/^(\w+)\s+(.+)$/);
    if (directMatch) {
        const [, className, rest] = directMatch;
        if (loaders[className]) {
            // Check if it's a list command (e.g., "users", "modpacks")
            const listCommands: Record<string, () => Promise<void>> = {
                users: async () => {
                    const { rows, total } = await loaders.user.findMany(rest);
                    const totalPages = Math.ceil(total / 20);
                    console.log(`\n  Users (${total} total)\n`);
                    printTable(rows.map((r) => ({ ...r, createdAt: formatDate(r.createdAt) })));
                    console.log();
                },
                modpacks: async () => {
                    const { rows, total } = await loaders.modpack.findMany(rest);
                    const totalPages = Math.ceil(total / 20);
                    console.log(`\n  Modpacks (${total} total)\n`);
                    printTable(rows.map((r) => ({ ...r, createdAt: formatDate(r.createdAt) })));
                    console.log();
                },
                creators: async () => {
                    const { rows, total } = await loaders.creator.findMany(rest);
                    console.log(`\n  Creators (${total} total)\n`);
                    printTable(rows);
                    console.log();
                },
            };

            if (rest === "" || /^\d+$/.test(rest)) {
                if (listCommands[className]) {
                    await listCommands[className]();
                    return;
                }
            }

            // Load single record
            await handleLoad(LAST_VAR, className, rest);
            return;
        }
    }

    // ── Direct variable reference ──
    if (isVarName(input)) {
        const obj = getVar(input);
        if (obj) {
            printObject(obj);
            return;
        }
    }

    console.log(`  Unknown command: "${input}". Type "help" for commands.`);
}

async function handleLoad(varName: string, className: string, query: string) {
    const loader = loaders[className];
    if (!loader) {
        console.log(`  Unknown type: "${className}". Available: ${Object.keys(loaders).join(", ")}`);
        return;
    }

    const row = await loader.findOne(query.trim());
    if (!row) {
        console.log(`  ${className} not found: "${query}"`);
        return;
    }

    setVar(varName, row);
    const label = row.username ?? row.displayName ?? row.name ?? row.id;
    console.log(`  ${varName} = ${className} "${label}"`);
    printObject(row);
}

async function handleSave(varName: string) {
    const obj = getVar(varName);
    if (!obj) {
        console.log(`  Variable "${varName}" not found.`);
        return;
    }

    // Determine which table this object belongs to
    let loader: Loader | null = null;
    if (obj.role !== undefined && obj.discordId !== undefined) loader = loaders.user;
    else if (obj.slug !== undefined && obj.visibility !== undefined) loader = loaders.modpack;
    else if (obj.displayName !== undefined && obj.status !== undefined) loader = loaders.creator;

    if (!loader) {
        console.log("  Cannot determine table for this object.");
        return;
    }

    if (!obj.id) {
        console.log("  Object has no id — cannot save.");
        return;
    }

    // Build update with only saveable fields that changed
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    let changed = false;
    for (const field of loader.saveFields) {
        if (obj[field] !== undefined) {
            updates[field] = obj[field];
            changed = true;
        }
    }

    if (!changed) {
        console.log("  No changes to save.");
        return;
    }

    const tableName = loader.tableName;
    const confirm = prompt(`  Save ${varName} to ${tableName}? [y/N]`);
    if (confirm?.toLowerCase() !== "y") {
        console.log("  Cancelled.");
        return;
    }

    const tableMap: Record<string, typeof users | typeof modpacksTable | typeof creatorsTable> = {
        users,
        modpacks: modpacksTable,
        creators: creatorsTable,
    };
    const table = tableMap[tableName];
    if (!table) {
        console.log(`  Unknown table: ${tableName}`);
        return;
    }

    await db.update(table).set(updates).where(eq(table.id, obj.id as string));
    console.log(`  ✅ Saved to ${tableName}`);
}

function parseValue(raw: string): unknown {
    const trimmed = raw.trim();

    // null
    if (trimmed === "null") return null;

    // string (quoted)
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
        return trimmed.slice(1, -1);
    }

    // boolean
    if (trimmed === "true") return true;
    if (trimmed === "false") return false;

    // number
    if (/^\d+$/.test(trimmed)) return parseInt(trimmed);
    if (/^\d+\.\d+$/.test(trimmed)) return parseFloat(trimmed);

    // unquoted string
    return trimmed;
}

function printHelp() {
    console.log(`
  ── Loading ──
    user <id|username>              Load user → stores in $_
    modpack <id|slug>               Load modpack → stores in $_
    creator <id|slug>               Load creator → stores in $_

  ── Variables ──
    u = user juan                   Load & store as 'u'
    $_                              Print last loaded object
    u                               Print variable 'u'
    vars                            List all variables
    drop u                          Remove variable

  ── Reading ──
    u.username                      Read property
    u.role                          Read property

  ── Writing ──
    u.role = "admin"                Set property (in memory)
    save u                          Persist changes to DB

  ── Listing ──
    users [page]                    List users
    modpacks [page]                 List modpacks
    creators [page]                 List creators
    users search <query>            Search users

  ── System ──
    sql <SELECT query>              Run raw SQL
    health                          Check DB connection
    exit                            Exit CLI
`);
}
