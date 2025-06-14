import { User } from "./User.model"; // User import might not be directly needed in this file unless used for type hints beyond User.id
import { z } from "zod";
import { SessionsTable } from "@/db/schema";
import { client as db } from "@/db/client";
import { eq } from "drizzle-orm";

// Zod schema for creating a new session
export const newSessionSchema = z.object({
  userId: z.string().uuid("Invalid User ID format"),
  // Using z.record(z.string(), z.any()) for JSONB fields. More specific schemas can be used if structure is known.
  deviceInfo: z.record(z.string(), z.any()).optional().default({}),
  locationInfo: z.record(z.string(), z.any()).optional().default({}),
});
type NewSessionInput = z.infer<typeof newSessionSchema>;

// Zod schema for updating a session
export const sessionUpdateSchema = z.object({
  deviceInfo: z.record(z.string(), z.any()).optional(),
  locationInfo: z.record(z.string(), z.any()).optional(),
});
type SessionUpdateInput = z.infer<typeof sessionUpdateSchema>;

// Type for the data structure of a Session, mirroring SessionsTable.$inferSelect
type SessionDataType = typeof SessionsTable.$inferSelect;

export class Session {
    readonly id: number; // serial primary key, so it's a number
    readonly userId: string; // uuid, so string
    deviceInfo: Record<string, any>; // Changed from Object to be more specific for JSONB
    locationInfo: Record<string, any>; // Changed from Object
    readonly createdAt: Date;
    updatedAt: Date;


    constructor(data: SessionDataType) {
        this.id = data.id;
        this.userId = data.userId;
        this.deviceInfo = data.deviceInfo || {}; // Drizzle's default used if null/undefined
        this.locationInfo = data.locationInfo || {}; // Drizzle's default used
        this.createdAt = data.createdAt;
        this.updatedAt = data.updatedAt;
    }

    static async create(data: NewSessionInput): Promise<Session> {
        const validationResult = newSessionSchema.safeParse(data);
        if (!validationResult.success) {
            throw new Error(`Invalid session data: ${JSON.stringify(validationResult.error.format())}`);
        }

        const now = new Date();
        const valuesToInsert = {
            ...validationResult.data,
            createdAt: now,
            updatedAt: now,
        };

        const [insertedRecord] = await db
            .insert(SessionsTable)
            .values(valuesToInsert)
            .returning();

        if (!insertedRecord) {
            throw new Error("Session creation failed: No record returned.");
        }
        return new Session(insertedRecord);
    }

    static async findById(sessionId: number): Promise<Session | null> {
        // Renamed from findBySessionId for consistency, assuming 'id' is the session's primary key
        if (typeof sessionId !== 'number' || sessionId <= 0) {
            // Basic validation for ID type and value
            console.error("Invalid sessionId for findById:", sessionId);
            return null;
        }
        try {
            const sessionRecord = await db.query.SessionsTable.findFirst({
                where: eq(SessionsTable.id, sessionId),
            });

            return sessionRecord ? new Session(sessionRecord) : null;
        } catch (error) {
            console.error(`Error finding session by ID ${sessionId}:`, error);
            return null; // Or throw
        }
    }

    static async update(id: number, data: SessionUpdateInput): Promise<Session> {
        const validationResult = sessionUpdateSchema.safeParse(data);
        if (!validationResult.success) {
            throw new Error(`Invalid session update data: ${JSON.stringify(validationResult.error.format())}`);
        }

        if (Object.keys(validationResult.data).length === 0) {
            const currentSession = await Session.findById(id);
            if (!currentSession) throw new Error("Session not found for update with empty payload.");
            return currentSession;
        }

        const updatePayload = {
            ...validationResult.data,
            updatedAt: new Date(),
        };

        try {
            const [updatedRecord] = await db
                .update(SessionsTable)
                .set(updatePayload)
                .where(eq(SessionsTable.id, id))
                .returning();

            if (!updatedRecord) {
                throw new Error("Session not found or update failed.");
            }
            return new Session(updatedRecord);
        } catch (error) {
            console.error(`Failed to update session ${id}:`, error);
            throw new Error(`Failed to update session: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async save(): Promise<Session> {
        const dataToSave: SessionUpdateInput = {
            deviceInfo: this.deviceInfo,
            locationInfo: this.locationInfo,
        };
        const updatedSession = await Session.update(this.id, dataToSave);
        // Update instance properties
        this.deviceInfo = updatedSession.deviceInfo;
        this.locationInfo = updatedSession.locationInfo;
        this.updatedAt = updatedSession.updatedAt;
        return this;
    }

    async revoke(): Promise<void> {
        try {
            await db.delete(SessionsTable).where(eq(SessionsTable.id, this.id));
        } catch (error) {
            console.error(`Failed to revoke session ${this.id}:`, error);
            throw new Error(`Failed to revoke session: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}