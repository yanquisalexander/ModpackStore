import "reflect-metadata";
import { DataSource } from "typeorm";
import { User } from "../entities/User";
import { Session } from "../entities/Session";
import { Publisher } from "../entities/Publisher";
import { PublisherMember } from "../entities/PublisherMember";
import { Scope } from "../entities/Scope";
import { Modpack } from "../entities/Modpack";
import { ModpackVersion } from "../entities/ModpackVersion";
import { ModpackFile } from "../entities/ModpackFile";
import { ModpackVersionFile } from "../entities/ModpackVersionFile";
import { Category } from "../entities/Category";
import { ModpackCategory } from "../entities/ModpackCategory";
import { Wallet } from "../entities/Wallet";
import { WalletTransaction } from "../entities/WalletTransaction";
import { UserPurchase } from "../entities/UserPurchase";
import { ModpackAcquisition } from "../entities/ModpackAcquisition";
import { AuditLog } from "../entities/AuditLog";
import { Ticket } from "../entities/Ticket";
import { TicketMessage } from "../entities/TicketMessage";

export const AppDataSource = new DataSource({
    type: "postgres",
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 5432,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === "true" ? true : false,
    synchronize: true,
    logging: process.env.NODE_ENV === "development",
    entities: [
        User,
        Session,
        Publisher,
        PublisherMember,
        Scope,
        Modpack,
        ModpackVersion,
        ModpackFile,
        ModpackVersionFile,
        Category,
        ModpackCategory,
        Wallet,
        WalletTransaction,
        UserPurchase,
        ModpackAcquisition,
        AuditLog,
        Ticket,
        TicketMessage
    ],
});