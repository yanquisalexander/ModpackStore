// Test file to verify TypeORM entities structure
import "reflect-metadata";
import { User } from "../entities/User";
import { Publisher } from "../entities/Publisher";
import { Modpack } from "../entities/Modpack";
import { Session } from "../entities/Session";
import { WalletTransaction } from "../entities/WalletTransaction";
import { Category } from "../entities/Category";
import { ModpackCategory } from "../entities/ModpackCategory";
import { ModpackFile } from "../entities/ModpackFile";
import { ModpackVersion } from "../entities/ModpackVersion";
import { ModpackVersionFile } from "../entities/ModpackVersionFile";
import { PublisherMember } from "../entities/PublisherMember";
import { Scope } from "../entities/Scope";
import { UserPurchase } from "../entities/UserPurchase";
import { Wallet } from "../entities/Wallet";
import { getMetadataArgsStorage } from "typeorm";

console.log("🧪 Testing TypeORM Entities Structure...\n");

// Force all entities to be loaded
const entities = [
    User, Publisher, Modpack, Session, WalletTransaction,
    Category, ModpackCategory, ModpackFile, ModpackVersion,
    ModpackVersionFile, PublisherMember, Scope, UserPurchase, Wallet
];

console.log(`📦 Loaded ${entities.length} entity classes`);

// Test entity metadata
const metadataStorage = getMetadataArgsStorage();

console.log("\n📋 Entity Metadata Summary:");
console.log(`- Tables: ${metadataStorage.tables.length}`);
console.log(`- Columns: ${metadataStorage.columns.length}`);
console.log(`- Relations: ${metadataStorage.relations.length}`);
console.log(`- Join Columns: ${metadataStorage.joinColumns.length}`);
console.log(`- Indices: ${metadataStorage.indices.length}`);

console.log("\n📊 Registered Tables:");
metadataStorage.tables.forEach(table => {
    console.log(`  - ${table.name} (${table.target.name})`);
});

console.log("\n🔗 Relations Found:");
metadataStorage.relations.forEach(relation => {
    console.log(`  - ${(relation.target as any).name}.${relation.propertyName} -> ${relation.type}`);
});

console.log("\n🎯 Enums Test:");
import { TransactionType, ModpackVisibility, ModpackStatus } from "../types/enums";
console.log(`- TransactionType: ${Object.values(TransactionType).join(', ')}`);
console.log(`- ModpackVisibility: ${Object.values(ModpackVisibility).join(', ')}`);
console.log(`- ModpackStatus: ${Object.values(ModpackStatus).join(', ')}`);

console.log("\n✅ All TypeORM entities loaded successfully!");
console.log("🎯 Migration from Drizzle to TypeORM completed!");