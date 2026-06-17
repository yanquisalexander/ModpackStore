import { db } from "@/db/client.ts";
import { users, UserRole } from "@/db/schema.ts";
import { eq } from "drizzle-orm";

export const SYSTEM_EMAIL = "system@app.local";

export async function generateSystemUser() {
    const [existing] = await db.select()
        .from(users)
        .where(eq(users.email, SYSTEM_EMAIL))
        .limit(1);

    if (existing) {
        console.log("System user already exists, skipping creation.");
        return;
    }

    console.log("System user not found, creating...");

    await db.insert(users).values({
        email: SYSTEM_EMAIL,
        avatarUrl: "/images/system-avatar.webp",
        username: "system",
        discordId: "userisnotauthenticable",
        role: UserRole.SYSTEM,
    });

    console.log("System user created successfully.");
}
