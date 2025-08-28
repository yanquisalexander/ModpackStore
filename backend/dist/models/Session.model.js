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
exports.Session = exports.sessionUpdateSchema = exports.newSessionSchema = void 0;
const zod_1 = require("zod");
const schema_1 = require("@/db/schema");
const client_1 = require("@/db/client");
const drizzle_orm_1 = require("drizzle-orm");
// Zod schema for creating a new session
exports.newSessionSchema = zod_1.z.object({
    userId: zod_1.z.string().uuid("Invalid User ID format"),
    // Using z.record(z.string(), z.any()) for JSONB fields. More specific schemas can be used if structure is known.
    deviceInfo: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional().default({}),
    locationInfo: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional().default({}),
});
// Zod schema for updating a session
exports.sessionUpdateSchema = zod_1.z.object({
    deviceInfo: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional(),
    locationInfo: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional(),
});
class Session {
    constructor(data) {
        this.id = data.id;
        this.userId = data.userId;
        this.deviceInfo = data.deviceInfo || {}; // Drizzle's default used if null/undefined
        this.locationInfo = data.locationInfo || {}; // Drizzle's default used
        this.createdAt = data.createdAt;
        this.updatedAt = data.updatedAt;
    }
    static create(data) {
        return __awaiter(this, void 0, void 0, function* () {
            const validationResult = exports.newSessionSchema.safeParse(data);
            if (!validationResult.success) {
                throw new Error(`Invalid session data: ${JSON.stringify(validationResult.error.format())}`);
            }
            const now = new Date();
            const valuesToInsert = Object.assign(Object.assign({}, validationResult.data), { createdAt: now, updatedAt: now });
            const [insertedRecord] = yield client_1.client
                .insert(schema_1.SessionsTable)
                .values(valuesToInsert)
                .returning();
            if (!insertedRecord) {
                throw new Error("Session creation failed: No record returned.");
            }
            return new Session(insertedRecord);
        });
    }
    static findById(sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Renamed from findBySessionId for consistency, assuming 'id' is the session's primary key
            if (typeof sessionId !== 'number' || sessionId <= 0) {
                // Basic validation for ID type and value
                console.error("Invalid sessionId for findById:", sessionId);
                return null;
            }
            try {
                const sessionRecord = yield client_1.client.query.SessionsTable.findFirst({
                    where: (0, drizzle_orm_1.eq)(schema_1.SessionsTable.id, sessionId),
                });
                return sessionRecord ? new Session(sessionRecord) : null;
            }
            catch (error) {
                console.error(`Error finding session by ID ${sessionId}:`, error);
                return null; // Or throw
            }
        });
    }
    static update(id, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const validationResult = exports.sessionUpdateSchema.safeParse(data);
            if (!validationResult.success) {
                throw new Error(`Invalid session update data: ${JSON.stringify(validationResult.error.format())}`);
            }
            if (Object.keys(validationResult.data).length === 0) {
                const currentSession = yield Session.findById(id);
                if (!currentSession)
                    throw new Error("Session not found for update with empty payload.");
                return currentSession;
            }
            const updatePayload = Object.assign(Object.assign({}, validationResult.data), { updatedAt: new Date() });
            try {
                const [updatedRecord] = yield client_1.client
                    .update(schema_1.SessionsTable)
                    .set(updatePayload)
                    .where((0, drizzle_orm_1.eq)(schema_1.SessionsTable.id, id))
                    .returning();
                if (!updatedRecord) {
                    throw new Error("Session not found or update failed.");
                }
                return new Session(updatedRecord);
            }
            catch (error) {
                console.error(`Failed to update session ${id}:`, error);
                throw new Error(`Failed to update session: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        });
    }
    save() {
        return __awaiter(this, void 0, void 0, function* () {
            const dataToSave = {
                deviceInfo: this.deviceInfo,
                locationInfo: this.locationInfo,
            };
            const updatedSession = yield Session.update(this.id, dataToSave);
            // Update instance properties
            this.deviceInfo = updatedSession.deviceInfo;
            this.locationInfo = updatedSession.locationInfo;
            this.updatedAt = updatedSession.updatedAt;
            return this;
        });
    }
    revoke() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield client_1.client.delete(schema_1.SessionsTable).where((0, drizzle_orm_1.eq)(schema_1.SessionsTable.id, this.id));
            }
            catch (error) {
                console.error(`Failed to revoke session ${this.id}:`, error);
                throw new Error(`Failed to revoke session: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        });
    }
}
exports.Session = Session;
