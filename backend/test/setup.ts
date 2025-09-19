// test/setup.ts
import "reflect-metadata";
import { config } from "dotenv";

// Load environment variables
config();

// Set test environment variables
process.env.NODE_ENV = "test";
process.env.DB_HOST = process.env.DB_HOST || "localhost";
process.env.DB_PORT = process.env.DB_PORT || "5432";
process.env.DB_USER = process.env.DB_USER || "test";
process.env.DB_PASSWORD = process.env.DB_PASSWORD || "test";
process.env.DB_NAME = process.env.DB_NAME || "modpackstore_test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-key";

// Increase test timeout for database operations
jest.setTimeout(30000);