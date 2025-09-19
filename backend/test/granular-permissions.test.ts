// test/granular-permissions.test.ts
import { AppDataSource } from "../src/db/data-source";
import { Publisher as PublisherEntity } from "../src/entities/Publisher";
import { PublisherMember as PublisherMemberEntity } from "../src/entities/PublisherMember";
import { User as UserEntity } from "../src/entities/User";
import { Scope as ScopeEntity } from "../src/entities/Scope";
import { Modpack as ModpackEntity } from "../src/entities/Modpack";
import { PublisherMemberRole } from "../src/types/enums";
import { PublisherTypeORM } from "../src/models/Publisher.typeorm";
import { hasPermission, canViewModpack, canModifyModpack, PERMISSIONS, grantPermissions } from "../src/utils/permissions";

describe('Granular Permissions System', () => {
    let publisher: PublisherEntity;
    let ownerUser: UserEntity;
    let adminUser: UserEntity;
    let memberUser: UserEntity;
    let modpack: ModpackEntity;

    beforeAll(async () => {
        // Initialize database connection
        if (!AppDataSource.isInitialized) {
            await AppDataSource.initialize();
        }

        // Clean up any existing test data
        await cleanupTestData();

        // Create test users
        ownerUser = UserEntity.create({
            username: 'owner_test',
            email: 'owner@test.com',
            admin: false
        });
        await ownerUser.save();

        adminUser = UserEntity.create({
            username: 'admin_test', 
            email: 'admin@test.com',
            admin: false
        });
        await adminUser.save();

        memberUser = UserEntity.create({
            username: 'member_test',
            email: 'member@test.com', 
            admin: false
        });
        await memberUser.save();

        // Create test publisher
        publisher = PublisherEntity.create({
            publisherName: 'Test Publisher',
            tosUrl: 'https://example.com/tos',
            privacyUrl: 'https://example.com/privacy',
            bannerUrl: 'https://example.com/banner.png',
            logoUrl: 'https://example.com/logo.png',
            description: 'Test publisher for granular permissions'
        });
        await publisher.save();

        // Create publisher members
        const ownerMember = PublisherMemberEntity.create({
            userId: ownerUser.id,
            publisherId: publisher.id,
            role: PublisherMemberRole.OWNER
        });
        await ownerMember.save();

        const adminMember = PublisherMemberEntity.create({
            userId: adminUser.id,
            publisherId: publisher.id,
            role: PublisherMemberRole.ADMIN
        });
        await adminMember.save();

        const memberMember = PublisherMemberEntity.create({
            userId: memberUser.id,
            publisherId: publisher.id,
            role: PublisherMemberRole.MEMBER
        });
        await memberMember.save();

        // Create test modpack
        modpack = ModpackEntity.create({
            name: 'Test Modpack',
            slug: 'test-modpack',
            iconUrl: 'https://example.com/icon.png',
            bannerUrl: 'https://example.com/banner.png',
            description: 'Test modpack for permissions',
            visibility: 'public',
            publisherId: publisher.id,
            createdBy: memberUser.id // Created by member user
        });
        await modpack.save();
    });

    afterAll(async () => {
        await cleanupTestData();
        if (AppDataSource.isInitialized) {
            await AppDataSource.destroy();
        }
    });

    async function cleanupTestData() {
        try {
            // Clean up in reverse order of dependencies
            await AppDataSource.getRepository(ScopeEntity).delete({});
            await AppDataSource.getRepository(ModpackEntity).delete({});
            await AppDataSource.getRepository(PublisherMemberEntity).delete({});
            await AppDataSource.getRepository(PublisherEntity).delete({});
            await AppDataSource.getRepository(UserEntity).delete({});
        } catch (error) {
            console.log('Cleanup error (expected in fresh environment):', error);
        }
    }

    describe('Role-based permissions', () => {
        test('Owner should have all permissions', async () => {
            const hasModpackView = await hasPermission(ownerUser.id, publisher.id, PERMISSIONS.MODPACK_VIEW, modpack.id);
            const hasModpackModify = await hasPermission(ownerUser.id, publisher.id, PERMISSIONS.MODPACK_MODIFY, modpack.id);
            const hasModpackDelete = await hasPermission(ownerUser.id, publisher.id, PERMISSIONS.MODPACK_DELETE, modpack.id);
            const hasPublisherStats = await hasPermission(ownerUser.id, publisher.id, PERMISSIONS.PUBLISHER_VIEW_STATS);

            expect(hasModpackView).toBe(true);
            expect(hasModpackModify).toBe(true);
            expect(hasModpackDelete).toBe(true);
            expect(hasPublisherStats).toBe(true);
        });

        test('Admin should have all permissions', async () => {
            const hasModpackView = await hasPermission(adminUser.id, publisher.id, PERMISSIONS.MODPACK_VIEW, modpack.id);
            const hasModpackModify = await hasPermission(adminUser.id, publisher.id, PERMISSIONS.MODPACK_MODIFY, modpack.id);
            const hasModpackDelete = await hasPermission(adminUser.id, publisher.id, PERMISSIONS.MODPACK_DELETE, modpack.id);
            const hasPublisherStats = await hasPermission(adminUser.id, publisher.id, PERMISSIONS.PUBLISHER_VIEW_STATS);

            expect(hasModpackView).toBe(true);
            expect(hasModpackModify).toBe(true);
            expect(hasModpackDelete).toBe(true);
            expect(hasPublisherStats).toBe(true);
        });

        test('Member should have limited default permissions', async () => {
            const hasModpackView = await hasPermission(memberUser.id, publisher.id, PERMISSIONS.MODPACK_VIEW, modpack.id);
            const hasModpackModify = await hasPermission(memberUser.id, publisher.id, PERMISSIONS.MODPACK_MODIFY, modpack.id);
            const hasModpackDelete = await hasPermission(memberUser.id, publisher.id, PERMISSIONS.MODPACK_DELETE, modpack.id);
            const hasPublisherStats = await hasPermission(memberUser.id, publisher.id, PERMISSIONS.PUBLISHER_VIEW_STATS);

            expect(hasModpackView).toBe(false);
            expect(hasModpackModify).toBe(false);
            expect(hasModpackDelete).toBe(false);
            expect(hasPublisherStats).toBe(false);
        });
    });

    describe('Modpack creator permissions', () => {
        test('Member can view their own modpack', async () => {
            const canView = await canViewModpack(memberUser.id, publisher.id, modpack.id, modpack.createdBy);
            expect(canView).toBe(true);
        });

        test('Member can modify their own modpack', async () => {
            const canModify = await canModifyModpack(memberUser.id, publisher.id, modpack.id, modpack.createdBy);
            expect(canModify).toBe(true);
        });

        test('Other member cannot view modpack without explicit permission', async () => {
            // Create another member user
            const otherMemberUser = UserEntity.create({
                username: 'other_member_test',
                email: 'other_member@test.com',
                admin: false
            });
            await otherMemberUser.save();

            const otherMember = PublisherMemberEntity.create({
                userId: otherMemberUser.id,
                publisherId: publisher.id,
                role: PublisherMemberRole.MEMBER
            });
            await otherMember.save();

            const canView = await canViewModpack(otherMemberUser.id, publisher.id, modpack.id, modpack.createdBy);
            expect(canView).toBe(false);

            // Cleanup
            await AppDataSource.getRepository(PublisherMemberEntity).remove(otherMember);
            await AppDataSource.getRepository(UserEntity).remove(otherMemberUser);
        });
    });

    describe('Granular permission granting', () => {
        test('Admin can grant modpack view permission to member', async () => {
            const memberRepository = AppDataSource.getRepository(PublisherMemberEntity);
            const member = await memberRepository.findOne({
                where: { userId: memberUser.id, publisherId: publisher.id }
            });

            expect(member).toBeTruthy();

            // Grant specific modpack view permission
            await grantPermissions(
                member!.id,
                { [PERMISSIONS.MODPACK_VIEW]: true },
                undefined,
                modpack.id
            );

            // Verify permission was granted
            const hasPermissionNow = await hasPermission(memberUser.id, publisher.id, PERMISSIONS.MODPACK_VIEW, modpack.id);
            expect(hasPermissionNow).toBe(true);

            // Verify other permissions are still denied
            const hasModifyPermission = await hasPermission(memberUser.id, publisher.id, PERMISSIONS.MODPACK_MODIFY, modpack.id);
            expect(hasModifyPermission).toBe(false);
        });

        test('Admin can grant organization-level permission to member', async () => {
            const memberRepository = AppDataSource.getRepository(PublisherMemberEntity);
            const member = await memberRepository.findOne({
                where: { userId: memberUser.id, publisherId: publisher.id }
            });

            // Grant publisher stats permission at organization level
            await grantPermissions(
                member!.id,
                { [PERMISSIONS.PUBLISHER_VIEW_STATS]: true },
                publisher.id,
                undefined
            );

            // Verify permission was granted
            const hasPermissionNow = await hasPermission(memberUser.id, publisher.id, PERMISSIONS.PUBLISHER_VIEW_STATS);
            expect(hasPermissionNow).toBe(true);
        });
    });

    describe('TypeORM Publisher methods', () => {
        test('isUserOwner should work correctly', async () => {
            const isOwner = await PublisherTypeORM.isUserOwner(ownerUser.id, publisher.id);
            const isNotOwner = await PublisherTypeORM.isUserOwner(memberUser.id, publisher.id);

            expect(isOwner).toBe(true);
            expect(isNotOwner).toBe(false);
        });

        test('isUserAdmin should work correctly', async () => {
            const ownerIsAdmin = await PublisherTypeORM.isUserAdmin(ownerUser.id, publisher.id);
            const adminIsAdmin = await PublisherTypeORM.isUserAdmin(adminUser.id, publisher.id);
            const memberIsNotAdmin = await PublisherTypeORM.isUserAdmin(memberUser.id, publisher.id);

            expect(ownerIsAdmin).toBe(true);
            expect(adminIsAdmin).toBe(true);
            expect(memberIsNotAdmin).toBe(false);
        });

        test('hasUserPermission should work correctly', async () => {
            const ownerHasPermission = await PublisherTypeORM.hasUserPermission(
                ownerUser.id, 
                publisher.id, 
                'MODPACK_VIEW' as keyof typeof PERMISSIONS,
                modpack.id
            );
            
            expect(ownerHasPermission).toBe(true);
        });
    });

    describe('Permission extensibility', () => {
        test('New permissions can be added without breaking existing structure', () => {
            // This test verifies that the permission system is extensible
            // by checking that our permission constants are properly defined
            expect(PERMISSIONS.MODPACK_VIEW).toBe('modpackView');
            expect(PERMISSIONS.MODPACK_MODIFY).toBe('modpackModify');
            expect(PERMISSIONS.MODPACK_MANAGE_VERSIONS).toBe('modpackManageVersions');
            expect(PERMISSIONS.MODPACK_PUBLISH).toBe('modpackPublish');
            expect(PERMISSIONS.MODPACK_DELETE).toBe('modpackDelete');
            expect(PERMISSIONS.MODPACK_MANAGE_ACCESS).toBe('modpackManageAccess');
            expect(PERMISSIONS.PUBLISHER_MANAGE_CATEGORIES_TAGS).toBe('publisherManageCategoriesTags');
            expect(PERMISSIONS.PUBLISHER_VIEW_STATS).toBe('publisherViewStats');

            // Legacy permissions should still exist
            expect(PERMISSIONS.CAN_CREATE_MODPACKS).toBe('canCreateModpacks');
            expect(PERMISSIONS.CAN_EDIT_MODPACKS).toBe('canEditModpacks');
        });
    });
});