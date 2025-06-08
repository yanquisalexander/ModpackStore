import { User } from "./User.model";
import { z } from "zod";
import { SessionsTable } from "@/db/schema";
import { client as db } from "@/db/client";
import { eq } from "drizzle-orm";
export class Session {
    id: number;
    userId: string;
    deviceInfo: Object;
    locationInfo: Object;
    createdAt: Date;
    updatedAt: Date;


    constructor(data: Partial<typeof SessionsTable.$inferSelect>) {
        this.id = data.id!;
        this.userId = data.userId!;
        this.deviceInfo = data.deviceInfo || {};
        this.locationInfo = data.locationInfo || {};
        this.createdAt = data.createdAt!;
        this.updatedAt = data.updatedAt!;
    }

    static async create(userId: string, deviceInfo: Object, locationInfo: Object): Promise<Session> {
        const now = new Date();
        const [inserted] = await db
            .insert(SessionsTable)
            .values({ userId, deviceInfo, locationInfo, createdAt: now, updatedAt: now })
            .returning();

        return new Session(inserted);
    }

    static async findBySessionId(sessionId: number): Promise<Session | null> {
        const session = await db
            .query.SessionsTable.findFirst({
                where: eq(SessionsTable.id, sessionId),
            });

        if (!session) return null;
        return new Session(session);
    }

    async revoke(): Promise<void> {
        await db.delete(SessionsTable).where(eq(SessionsTable.id, this.id));
    }

    async update(data: Partial<Session>): Promise<Session> {
        const now = new Date();
        const updateData: Partial<Session> & { updatedAt: Date } = { ...data, updatedAt: now };

        await db.update(SessionsTable).set(updateData).where(eq(SessionsTable.id, this.id));
        const updated = await Session.findBySessionId(this.id);
        if (!updated) throw new Error("Failed to update session.");
        return updated;
    }

}