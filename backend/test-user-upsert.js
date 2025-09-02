#!/usr/bin/env node
/**
 * Simple test script to verify the user upsert functionality
 */

import "reflect-metadata";
import { AppDataSource } from "../src/db/data-source";
import { UserService } from "../src/services/user.service";

async function testUserUpsert() {
    try {
        // Initialize database connection
        console.log('Initializing database connection...');
        await AppDataSource.initialize();
        console.log('Database connected successfully!');

        // Test data
        const testDiscordUser = {
            discordId: "123456789012345678",
            username: "testuser",
            email: "test@example.com",
            avatar: "abc123",
            provider: "discord" as const
        };

        console.log('\n--- Testing User Upsert ---');
        
        // Test 1: Create new user
        console.log('Test 1: Creating new user...');
        const newUser = await UserService.upsertDiscordUser(testDiscordUser);
        console.log('✅ User created:', {
            id: newUser.id,
            username: newUser.username,
            discordId: newUser.discordId,
            provider: newUser.provider,
            lastLoginAt: newUser.lastLoginAt
        });

        // Test 2: Update existing user
        console.log('\nTest 2: Updating existing user...');
        const updatedUserData = {
            ...testDiscordUser,
            username: "updateduser",
            avatar: "xyz789"
        };
        
        const updatedUser = await UserService.upsertDiscordUser(updatedUserData);
        console.log('✅ User updated:', {
            id: updatedUser.id,
            username: updatedUser.username,
            discordId: updatedUser.discordId,
            avatarUrl: updatedUser.avatarUrl,
            lastLoginAt: updatedUser.lastLoginAt
        });

        // Verify it's the same user
        console.log(`✅ Same user ID: ${newUser.id === updatedUser.id}`);

        // Test 3: Update tokens
        console.log('\nTest 3: Updating Discord tokens...');
        await UserService.updateDiscordTokens(
            updatedUser.id,
            "access_token_123",
            "refresh_token_456"
        );
        console.log('✅ Tokens updated successfully');

        // Clean up - remove test user
        console.log('\nCleaning up test data...');
        await updatedUser.remove();
        console.log('✅ Test user removed');

        console.log('\n🎉 All tests passed!');

    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    } finally {
        // Close database connection
        if (AppDataSource.isInitialized) {
            await AppDataSource.destroy();
            console.log('Database connection closed.');
        }
    }
}

// Run the test
testUserUpsert();